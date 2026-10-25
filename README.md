# GameShelf

A retro-arcade portal for your own browser games. Static site (HTML, CSS, vanilla JS, no build step) for GitHub Pages, with optional Supabase accounts and leaderboards.

## Status — read this first

- **No games are registered.** The game HTML files were not available when this was generated, so the catalog in `script.js` is empty and the library shows setup instructions. Nothing was invented or inspected.
- **Leaderboards are off for every game** until you connect a game to the score hook (see [Leaderboards](#leaderboards)) and add Supabase credentials.
- The code has **not been run in a browser or against a live Supabase project**. JavaScript files passed a syntax check (`node --check`) and `manifest.json` parses as JSON. The Edge Function and SQL are untested. Test them with the checklist at the end.

## Files

```
GameShelf/
├── index.html            page shell
├── style.css             themes, layout, generated thumbnails (CSS only)
├── script.js             CONFIG + catalog at the top, then all site logic
├── supabase-config.js    your Supabase URL + publishable key (placeholders)
├── gameshelf-score.js    optional helper a game can include to submit scores
├── sw.js                 small service worker (offline homepage shell only)
├── manifest.json         installable-app metadata
├── assets/               generated icons (icon.svg, icon-192.png, icon-512.png)
├── games/                PUT YOUR GAME HTML FILES HERE
└── supabase/
    ├── schema.sql
    └── functions/submit-score/index.ts
```

All paths are relative, so the site works at `https://YOUR-USERNAME.github.io/GameShelf/` or any other subpath.

## Add a game

1. Copy the game file into `games/`, keeping its name (for example `games/space-run.html`).
2. Add an entry to `GAME_CATALOG` in `script.js`:

```js
{
  id: 'space-run',                       // lowercase letters, numbers, hyphens; must be unique
  title: 'Space Run',
  description: 'Dodge asteroids for as long as you can.',
  category: 'arcade',                    // existing category id, or a new one
  tags: ['endless', 'space'],
  file: 'games/space-run.html',          // exact filename
  featured: false,
  thumb: { colors: ['#39ff14', '#7b2cff'], symbol: '🚀', pattern: 'grid' }   // optional
}
```

No image file is needed. If you leave out `thumb`, a colour, pattern and symbol are generated from the game's id and category. Entries with a bad id, a duplicate id or an unsafe `file` path are skipped and listed under Settings → Advanced → Show diagnostics.

**Check each game for dependencies.** GameShelf opens your file as-is. If a game loads other files (images, audio, scripts, fonts) or external URLs, those must also exist in `games/` (or be reachable online), or the game will break. If the file is missing, the in-page player shows an error instead of a blank screen. Games that depend on external resources will not work offline.

**Launch modes.** The default opens games in an in-page player (Back button, fullscreen, favorite). It uses a same-origin iframe, which suits files hosted in this repo. If a particular game misbehaves in the player (pointer lock, fullscreen or audio quirks), set `display: { launch: 'direct' }` on its entry to open the page directly, and the player's "Open directly" link is always available. Direct mode has no GameShelf Back button; use the browser's Back.

## Run locally

```
cd GameShelf
python3 -m http.server 8000
```

Open http://localhost:8000. Use a local server rather than double-clicking `index.html`, because the service worker, fullscreen checks and file checks need `http://`.

## Deploy to GitHub Pages

1. On github.com choose **New repository**, name it (for example `GameShelf`), set it Public, and create it.
2. Upload everything in this folder to the repository root so `index.html` sits at the top level (drag and drop in the web UI, or `git add . && git commit -m "GameShelf" && git push`).
3. Go to **Settings → Pages**. Under **Build and deployment** pick **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
4. After a minute the site is live at `https://YOUR-USERNAME.github.io/REPO-NAME/`.

## Set up Supabase (optional, for leaderboards)

1. Create a project at supabase.com.
2. **SQL Editor** → paste all of `supabase/schema.sql` → Run.
3. **Authentication → Sign In / Providers**: enable **Anonymous sign-ins**. Under **URL Configuration**, set the Site URL to your GitHub Pages address and add it to the redirect URLs (needed for email confirmation links).
4. Put your project URL and **publishable** key (Project Settings → API / API Keys) into `supabase-config.js`. Never use the service-role/secret key there.
5. Deploy the function with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy submit-score
supabase secrets set ALLOWED_ORIGINS=https://YOUR-USERNAME.github.io
```

`ALLOWED_ORIGINS` takes only the origin (no repository path). Without it the function allows any origin; it still requires a valid signed-in user.

## Leaderboards

A leaderboard is only offered for a game that can report its own score. GameShelf cannot read a score from inside a game, so each game needs a one-line hook, and that means a small edit to that game's HTML. Inspect the game first. If its score is not reliably accessible, leave its leaderboard disabled; don't rewrite a game just to force it.

To connect a game:

1. Register it in the database (SQL Editor). `id` must match `leaderboard.gameId`; `max_score` is the highest plausible score:

```sql
insert into public.games (id, title, min_score, max_score)
values ('space-run', 'Space Run', 0, 1000000)
on conflict (id) do update set title = excluded.title, max_score = excluded.max_score;
```

2. Set `leaderboard: { enabled: true, gameId: 'space-run' }` on its catalog entry.
3. In the game's HTML, add before its own script, then call `submit` with an integer when a run ends:

```html
<script src="../supabase-config.js"></script>
<script src="../gameshelf-score.js"></script>
<script>GameShelfScore.submit('space-run', finalScore);</script>
```

Players are signed in as an anonymous guest automatically on their first submitted score. Guests can upgrade to a permanent account in the Account panel. A guest account lives only in that browser; signing out or clearing site data loses it.

**Security model.** Browsers can read scores and edit only their own display name; they have no insert/update/delete rights on scores (Row Level Security plus revoked privileges). Scores enter only through `submit-score`, which authenticates the user, validates the body, checks the game's score range, applies rate limits (6 per minute, 5 seconds between scores in one game) and writes with the server-side service role. This does **not** make client-side games cheat-proof: a determined player can still send a plausible fake score. Stronger protection needs game-specific checks (hooks are provided in `GAME_VALIDATORS`) or server-authoritative gameplay.

## Customization

The Settings screen (gear icon) is intentionally small, like a console or phone OS: **Personalization** (theme, accent color, text size, CRT scanlines, status bar, battery percentage), **Accessibility** (reduce motion, high contrast; when off they follow your device setting) and **Privacy & data** (clear recently played, reset favorites, reset settings). Choices persist in `localStorage`.

Deeper changes are made in code, in `DEFAULT_SETTINGS` at the top of `script.js`: site title, tagline, logo text, footer, navigation links, section order and visibility, category names and order, default sorting and category, grid density, card corners, fonts, background style and launch mode. Those defaults are separate from the choices saved in a visitor's browser, so a visitor's saved choices override them until they reset settings.

The status bar (battery, online, time, date, fullscreen) is optional. Battery shows only where the browser provides the Battery Status API (mostly Chromium); otherwise it stays hidden and no value is invented. "Online" reflects `navigator.onLine`, not whether Supabase is reachable.

## Installable app (PWA)

`manifest.json` plus `sw.js` let browsers install GameShelf and open its homepage offline. The service worker caches only the site shell and never games, account data or Supabase requests. Games work offline only if they need nothing beyond their own file, and they are not cached by this worker.

## Known limitations

- Not tested in a browser or against a live Supabase project by the author of this code; run the checklist below.
- The Supabase JS library loads from jsDelivr (pinned to 2.45.4) and the pixel font from Google Fonts. If either is blocked the site still works (fallback font; no online features).
- Some games that rely on `window.top` access, pointer lock or exotic permissions may not behave inside the iframe player; use direct launch for those.
- The leaderboard view picks each player's best score with `DISTINCT ON`, which is fine for small and medium tables; add a materialized table if a game grows to millions of rows.
- Display names are not unique and are only lightly validated; there is no moderation tool.

## Test checklist

- [ ] Site loads locally and on Pages with no console errors; a missing game shows the error panel.
- [ ] Each catalog game launches in both modes; favorites and recently played survive a reload.
- [ ] Search matches title, description, category and tags; category chips filter.
- [ ] Settings persist across reload; dark, light and system themes.
- [ ] Mobile layout at about 375 px wide; keyboard-only navigation works.
- [ ] Supabase: guest sign-in, display name change, submit a score, see it on Top 10, upgrade to email account, sign out.
- [ ] Direct writes are refused: from the browser console, `supabase.from('scores').insert(...)` must fail.
- [ ] Function limits: score above `max_score` gives 422; rapid repeats give 429.
