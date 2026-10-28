export type DeviceKind = 'android' | 'ios' | 'desktop';

/**
 * Coarse device detection for choosing the UPI hand-off strategy.
 * iPadOS 13+ reports a Mac user agent, so touch support is the tie-breaker.
 * With no arguments it reads `navigator`.
 */
export function detectDevice(
  userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  maxTouchPoints: number = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
): DeviceKind {
  const ua = userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/macintosh/.test(ua) && maxTouchPoints > 1) return 'ios';
  return 'desktop';
}
