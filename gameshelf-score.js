/* GameShelf — gameshelf-score.js  (OPTIONAL helper, only for games you choose to connect)
   Add to a game's HTML, before its own script:
       <script src="../supabase-config.js"></script>
       <script src="../gameshelf-score.js"></script>
   then call, when a run ends:
       GameShelfScore.submit('my-game', finalScoreAsInteger);
   - Inside GameShelf's in-page player it forwards the score to the page (same-origin postMessage).
   - Opened directly, it signs in (guest if needed, sharing GameShelf's session) and calls the submit-score function.
   The server validates the score; this file is a convenience, not a security boundary. */
(function () {
  'use strict';
  var SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  var clientPromise = null;

  function getClient() {
    if (clientPromise) return clientPromise;
    var cfg = window.GAMESHELF_SUPABASE;
    if (!cfg || !cfg.url || /YOUR/i.test(cfg.url) || !cfg.publishableKey || /YOUR/i.test(cfg.publishableKey)) {
      return Promise.reject(new Error('supabase-config.js is not filled in'));
    }
    clientPromise = new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement('script');
      s.src = SDK; s.async = true; s.onload = resolve;
      s.onerror = function () { reject(new Error('could not load Supabase library')); };
      document.head.appendChild(s);
    }).then(function () { return window.supabase.createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: true } }); });
    return clientPromise;
  }

  window.GameShelfScore = {
    submit: function (gameId, score) {
      if (!Number.isSafeInteger(score) || score < 0) return Promise.resolve({ ok: false, error: 'score must be a non-negative integer' });
      if (window.parent !== window) {
        window.parent.postMessage({ source: 'gameshelf', type: 'score', gameId: gameId, score: score }, location.origin);
        return Promise.resolve({ ok: true, via: 'gameshelf-player' });
      }
      return getClient().then(function (client) {
        return client.auth.getSession().then(function (r) {
          return r.data.session || client.auth.signInAnonymously().then(function (x) { if (x.error) throw x.error; return x.data.session; });
        }).then(function () { return client.functions.invoke('submit-score', { body: { gameId: gameId, score: score } }); })
          .then(function (r) { if (r.error) throw r.error; return r.data; });
      }).catch(function (e) { return { ok: false, error: e.message || String(e) }; });
    }
  };
})();
