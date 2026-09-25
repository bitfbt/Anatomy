// Same-origin iframe support is required by the bundled privacy notice.
// WASM compilation is required by MediaPipe; arbitrary JS eval stays disabled.
export const contentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ');

// frame-ancestors is enforced only as a response header, not in a meta tag.
export const metaContentSecurityPolicy = contentSecurityPolicy.replace("; frame-ancestors 'self'", '');
export const securityHeaders = {
  'Content-Security-Policy': contentSecurityPolicy,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()',
  'X-Frame-Options': 'SAMEORIGIN',
};
