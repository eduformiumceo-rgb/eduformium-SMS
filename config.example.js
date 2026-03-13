// ══════════════════════════════════════════════════════════════════
//  EDUFORMIUM SMS — Local development config template
//
//  For LOCAL DEVELOPMENT ONLY (not Cloudflare Pages).
//  Copy this file to config.js and fill in real values.
//  config.js is in .gitignore — never commit real keys.
//
//  On Cloudflare Pages, /config.js is served by functions/config.js.js
//  which reads from environment variables. You don't need this file
//  in production at all.
// ══════════════════════════════════════════════════════════════════

window.APP_CONFIG = {
  dev: {
    url:     'https://YOUR_DEV_PROJECT.supabase.co',
    anonKey: 'YOUR_DEV_ANON_KEY',
  },
  prod: {
    url:     'https://YOUR_PROD_PROJECT.supabase.co',
    anonKey: 'YOUR_PROD_ANON_KEY',
  },
};
