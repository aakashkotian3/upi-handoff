/**
 * UPI deep links. Pure string building on purpose: some UPI apps reject a
 * percent-encoded "@" in `pa`, so only `pn` and `tn` are encoded.
 */

export interface UpiLinkInput {
  /** The payee's UPI ID (VPA), e.g. "riya@okaxis". */
  upiId: string;
  /** Payee display name. */
  name: string;
  /**
   * Integer paise, rendered with exactly two decimals. Omit to let the payer
   * type the amount in their UPI app: some apps block person-to-person links
   * with a prefilled amount.
   */
  amountPaise?: number;
  /** Transaction note. Truncated to 50 characters. */
  note?: string;
}

export type UpiApp = 'phonepe' | 'gpay' | 'paytm' | 'cred' | 'bhim';

export interface UpiAppInfo {
  id: UpiApp;
  name: string;
  /** Android package name, used to open this exact app. */
  androidPackage: string;
  /** The app's own URL scheme and path, used on iPhone. */
  iosScheme: string;
}

/** The UPI apps most people in India pay with. */
export const UPI_APPS: readonly UpiAppInfo[] = [
  { id: 'phonepe', name: 'PhonePe', androidPackage: 'com.phonepe.app', iosScheme: 'phonepe://pay' },
  { id: 'gpay', name: 'Google Pay', androidPackage: 'com.google.android.apps.nbu.paisa.user', iosScheme: 'tez://upi/pay' },
  { id: 'paytm', name: 'Paytm', androidPackage: 'net.one97.paytm', iosScheme: 'paytmmp://pay' },
  { id: 'cred', name: 'CRED', androidPackage: 'com.dreamplug.androidapp', iosScheme: 'credpay://upi/pay' },
  { id: 'bhim', name: 'BHIM', androidPackage: 'in.org.npci.upiapp', iosScheme: 'bhim://upi/pay' },
];

export const UPI_NOTE_MAX = 50;

function appInfo(app: UpiApp): UpiAppInfo {
  const info = UPI_APPS.find((a) => a.id === app);
  if (!info) throw new RangeError(`unknown UPI app: ${app}`);
  return info;
}

/** 1000 -> "10.00", 12345 -> "123.45". Integer math only. */
export function formatUpiAmount(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw new RangeError('amountPaise must be a positive integer');
  }
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return `${rupees}.${rest.toString().padStart(2, '0')}`;
}

/** True for something shaped like a UPI ID: "name@handle". */
export function isUpiId(value: string): boolean {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(value.trim());
}

function query({ upiId, name, amountPaise, note = '' }: UpiLinkInput): string {
  const pa = upiId.trim();
  if (!isUpiId(pa)) throw new RangeError('invalid UPI id');
  const tn = note.slice(0, UPI_NOTE_MAX);
  const am = amountPaise === undefined ? '' : `&am=${formatUpiAmount(amountPaise)}`;
  return `pa=${pa}&pn=${encodeURIComponent(name)}${am}&cu=INR&tn=${encodeURIComponent(tn)}`;
}

/**
 * upi://pay?pa=…&pn=…[&am=10.00]&cu=INR&tn=…, the link to put in a QR code.
 * Tapped on a phone it goes to the default UPI handler, which is often
 * WhatsApp, so prefer `buildUpiAppLink` or `buildUpiAndroidIntent` for buttons.
 */
export function buildUpiLink(input: UpiLinkInput): string {
  return `upi://pay?${query(input)}`;
}

/**
 * App-specific scheme for iPhone. There is no app chooser on iOS: the generic
 * upi:// opens whichever app claimed it, which is often WhatsApp.
 */
export function buildUpiAppLink(app: UpiApp, input: UpiLinkInput): string {
  return `${appInfo(app).iosScheme}?${query(input)}`;
}

/**
 * Android Chrome intent URL that opens one specific app with the upi://pay
 * data. If that app is not installed, Chrome opens its Play Store page.
 */
export function buildUpiAndroidIntent(app: UpiApp, input: UpiLinkInput): string {
  return `intent://pay?${query(input)}#Intent;scheme=upi;package=${appInfo(app).androidPackage};end`;
}
