// ══════════════════════════════════════════════════════════════════
//  EDUFORMIUM SMS — Cloudflare Worker entry point
// ══════════════════════════════════════════════════════════════════

const SECURITY_HEADERS = {
  'X-Frame-Options':           'DENY',
  'X-Content-Type-Options':    'nosniff',
  'Referrer-Policy':           'strict-origin-when-cross-origin',
  'Permissions-Policy':        'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy':   [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://eduformium-otp.school-management.workers.dev https://cdnjs.cloudflare.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

function applySecurityHeaders(response) {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers:    newHeaders,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Serve runtime config — keys come from env vars, never source code
    if (url.pathname === '/config.js') {
      const config = {
        dev:  { url: 'https://yayfpzjvdckyeaimvbwu.supabase.co', anonKey: env.DEV_SUPABASE_ANON_KEY  || '' },
        prod: { url: 'https://czfhqqqnjprxwrlwmkox.supabase.co', anonKey: env.PROD_SUPABASE_ANON_KEY || '' },
      };
      return new Response(
        `window.APP_CONFIG = ${JSON.stringify(config)};`,
        {
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type':  'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // Everything else → static assets with security headers applied
    const response = await env.ASSETS.fetch(request);
    return applySecurityHeaders(response);
  },
};