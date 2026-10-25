/* GameShelf — supabase-config.js
   Fill in the two values below (Supabase dashboard → Project Settings → API / API Keys).
   - url:            your project URL, e.g. https://abcdefghijklmnop.supabase.co
   - publishableKey: the "publishable" key (sb_publishable_...) or the legacy "anon" key.
   These two values are designed to be public in frontend code; Row Level Security protects the data.
   NEVER put a service_role / secret key or a database password in this file.
   Leave the placeholders as they are and GameShelf simply runs without online features. */
window.GAMESHELF_SUPABASE = {
  url: 'https://YOUR-PROJECT-REF.supabase.co',
  publishableKey: 'YOUR-SUPABASE-PUBLISHABLE-KEY'
};
