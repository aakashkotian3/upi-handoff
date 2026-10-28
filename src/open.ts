import { detectDevice, type DeviceKind } from './device.js';
import { buildUpiAndroidIntent, buildUpiAppLink, type UpiApp, type UpiLinkInput } from './links.js';

/** How long after the tap the page may still be visible before we decide the app isn't there (iOS). */
export const APP_OPEN_GRACE_MS = 1500;

export interface OpenUpiAppOptions {
  /** Defaults to `detectDevice()`. */
  device?: DeviceKind;
  /**
   * iPhone only: called when the page is still visible after `graceMs`, which
   * means the app is not installed. Show a QR code or the UPI ID to copy.
   * (Android needs no fallback: Chrome opens the Play Store instead.)
   */
  onNotInstalled?: () => void;
  graceMs?: number;
  /** Defaults to `window.location.href = url`. */
  navigate?: (url: string) => void;
}

/**
 * Opens one specific UPI app with the payment filled in: an intent:// URL on
 * Android, the app's own scheme on iPhone. A bare upi:// link would go to the
 * phone's default UPI handler, which is often WhatsApp.
 *
 * Returns false on desktop, where there are no UPI apps: show a QR code of
 * `buildUpiLink(input)` instead.
 */
export function openUpiApp(app: UpiApp, input: UpiLinkInput, options: OpenUpiAppOptions = {}): boolean {
  const { device = detectDevice(), onNotInstalled, graceMs = APP_OPEN_GRACE_MS } = options;
  const navigate = options.navigate ?? ((url: string) => void (window.location.href = url));

  if (device === 'desktop') return false;
  if (device === 'android') {
    navigate(buildUpiAndroidIntent(app, input));
    return true;
  }
  navigate(buildUpiAppLink(app, input));
  if (onNotInstalled) {
    window.setTimeout(() => {
      // Still here, so the app didn't open.
      if (document.visibilityState === 'visible') onNotInstalled();
    }, graceMs);
  }
  return true;
}
