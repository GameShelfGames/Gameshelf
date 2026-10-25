// GameShelf — supabase/functions/submit-score/index.ts
// Deploy:  supabase functions deploy submit-score
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically
//          by Supabase. Optionally restrict browsers with:
//          supabase secrets set ALLOWED_ORIGINS=https://YOUR-USERNAME.github.io
//
// Flow: authenticate the caller → validate the body → look up the game's score limits →
//       rate limit → insert with the service role. Browsers can never insert scores directly.
//
// Honest limitation: the score is reported by client-side game code, so a determined player can
// still send a plausible fake score. Bounds and rate limits reduce abuse; strong anti-cheat needs
// game-specific validation (see GAME_VALIDATORS) or server-authoritative gameplay.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const RATE = { windowSeconds: 60, maxPerWindow: 6, minSecondsBetweenSameGame: 5 };
const MAX_BODY_BYTES = 512;
const GAME_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

// Optional per-game checks. Return an error string to reject the score, or null to accept.
// Example: GAME_VALIDATORS["my-game"] = (score) => (score % 10 === 0 ? null : "invalid score step");
const GAME_VALIDATORS: Record<string, (score: number) => string | null> = {};

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.length === 0) h["Access-Control-Allow-Origin"] = "*";
  else if (origin && ALLOWED_ORIGINS.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  const reply = (status: number, body: Record<string, unknown>, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, ...extra, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed." });

  // 1. Authenticate the player from their access token.
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer .{20,}$/.test(auth)) return reply(401, { error: "Sign in required." });
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user) return reply(401, { error: "Invalid or expired session." });
  const userId = userData.user.id;

  // 2. Parse and validate the request body.
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, { error: "Request too large." });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return reply(400, { error: "Body must be valid JSON." }); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return reply(400, { error: "Body must be a JSON object." });
  const { gameId, score, ...extra } = body as Record<string, unknown>;
  if (Object.keys(extra).length > 0) return reply(400, { error: "Unexpected fields in request." });
  if (typeof gameId !== "string" || !GAME_ID.test(gameId)) return reply(400, { error: "Invalid gameId." });
  if (typeof score !== "number" || !Number.isSafeInteger(score) || score < 0) return reply(400, { error: "score must be a non-negative integer." });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // 3. The game must be registered and enabled; enforce its score range.
  const { data: game, error: gameErr } = await admin.from("games").select("id,min_score,max_score,enabled").eq("id", gameId).maybeSingle();
  if (gameErr) { console.error("games lookup", gameErr.message); return reply(500, { error: "Could not check the game." }); }
  if (!game || !game.enabled) return reply(404, { error: "Unknown or disabled game." });
  if (score < Number(game.min_score) || score > Number(game.max_score)) return reply(422, { error: "Score is outside the allowed range for this game." });
  const custom = GAME_VALIDATORS[gameId]?.(score);
  if (custom) return reply(422, { error: custom });

  // 4. Rate limit per player (overall window + minimum gap per game).
  const since = new Date(Date.now() - RATE.windowSeconds * 1000).toISOString();
  const recent = await admin.from("scores").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if (recent.error) { console.error("rate check", recent.error.message); return reply(500, { error: "Could not submit score." }); }
  if ((recent.count ?? 0) >= RATE.maxPerWindow) return reply(429, { error: "Too many submissions. Try again shortly." }, { "Retry-After": String(RATE.windowSeconds) });
  const last = await admin.from("scores").select("created_at").eq("user_id", userId).eq("game_id", gameId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last.data && Date.now() - new Date(last.data.created_at).getTime() < RATE.minSecondsBetweenSameGame * 1000) {
    return reply(429, { error: "Please wait a few seconds between scores." }, { "Retry-After": String(RATE.minSecondsBetweenSameGame) });
  }

  // 5. Make sure the profile exists, then insert the score under the authenticated identity.
  await admin.from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
  const prevBest = await admin.from("scores").select("score").eq("user_id", userId).eq("game_id", gameId).order("score", { ascending: false }).limit(1).maybeSingle();
  const { error: insErr } = await admin.from("scores").insert({ game_id: gameId, user_id: userId, score });
  if (insErr) { console.error("insert", insErr.message); return reply(500, { error: "Could not save score." }); }

  // 6. Report personal best and rank.
  const best = Math.max(score, Number(prevBest.data?.score ?? 0));
  const better = await admin.from("leaderboard_best").select("user_id", { count: "exact", head: true }).eq("game_id", gameId).gt("score", best);
  return reply(200, { ok: true, score, personalBest: best, isPersonalBest: score >= best && score > Number(prevBest.data?.score ?? -1), rank: (better.count ?? 0) + 1 });
});
