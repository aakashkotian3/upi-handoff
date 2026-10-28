# upi-handoff

Send a web app's users to the right UPI app on Android and iPhone, and ask "Did you pay?" when they come back.

Zero dependencies. About 3 KB gzipped. Works in any framework, or none.

```bash
npm install upi-handoff
```

## Why

Building a UPI link is easy. Getting a phone browser to open the right app, and knowing what happened afterwards, is not:

- **A bare `upi://` link often opens WhatsApp.** Android sends it to the phone's default UPI handler, and iPhone has no app chooser at all. `openUpiApp` opens the exact app the user picked: an `intent://` URL on Android, the app's own scheme on iPhone.
- **iPhone gives no error when the app isn't installed.** The tap just does nothing. `openUpiApp` notices the page never went to the background and calls `onNotInstalled`, so you can show a QR code instead.
- **A web page never hears back from the UPI app.** The best you can do is ask the payer as soon as they return. `createPaymentCheck` does that, and still asks if the phone reloaded your page while the UPI app was open.
- **Some UPI apps reject a percent-encoded `@` in the UPI ID**, and amounts must have exactly two decimals. The link builders handle both.

This came out of [BroPayy](https://bropayy.vercel.app), a trip-expense app where friends settle up over UPI.

## Usage

### 1. Let the payer pick an app

A web page can't see which apps are installed, so offer them all. Remember the last one they used.

```ts
import { UPI_APPS, detectDevice, openUpiApp } from 'upi-handoff';

const payee = { upiId: 'riya@okaxis', name: 'Riya', amountPaise: 30000, note: 'Goa trip' };

if (detectDevice() === 'desktop') {
  showQr(); // no UPI apps on a laptop
} else {
  renderButtons(UPI_APPS); // [{ id: 'phonepe', name: 'PhonePe', … }, …]
}

function onPick(app) {
  check.start({ to: 'Riya', amountPaise: 30000 }); // see step 2
  openUpiApp(app, payee, { onNotInstalled: showQr });
}
```

### 2. Ask "Did you pay?" when they come back

Create the check once, somewhere that's on every page (a root layout), so it still asks when the payer comes back to a different screen.

```ts
import { createPaymentCheck } from 'upi-handoff';

const check = createPaymentCheck({
  onReturn: (attempt) => showDidYouPay(attempt.data), // { to: 'Riya', amountPaise: 30000 }
});

// When they answer, yes or no:
check.clear();
```

`onReturn` can fire again for the same attempt (say, the payer switches apps once more) until you call `clear()`, so make showing the prompt idempotent.

For an "I've paid" button, `check.ask(data)` saves the attempt and calls `onReturn` straight away.

### 3. QR code for desktop, or when the app is missing

`buildUpiLink` gives the standard `upi://pay` link. Draw it with any QR library:

```ts
import QRCode from 'qrcode';
import { buildUpiLink } from 'upi-handoff';

const src = await QRCode.toDataURL(buildUpiLink(payee));
```

### React

```tsx
useEffect(() => {
  const check = createPaymentCheck({ onReturn: (a) => setAsking(a.data) });
  setCheck(check);
  return () => check.destroy();
}, []);
```

`createPaymentCheck` and `openUpiApp` use `window` and `document`, so call them in the browser (inside `useEffect` or an event handler), not during server rendering. The link builders are plain functions and work anywhere.

## API

### Links

| Function | Returns |
| --- | --- |
| `buildUpiLink(input)` | `upi://pay?pa=…&pn=…&am=…&cu=INR&tn=…`, for QR codes |
| `buildUpiAppLink(app, input)` | The app's own scheme, e.g. `phonepe://pay?…`, for iPhone |
| `buildUpiAndroidIntent(app, input)` | `intent://pay?…#Intent;scheme=upi;package=…;end`, for Android |
| `formatUpiAmount(paise)` | `30000` → `"300.00"` |
| `isUpiId(value)` | `true` for `name@handle` |

`input` is `{ upiId, name, amountPaise?, note? }`:

- `amountPaise` is an integer number of paise. Leave it out to let the payer type the amount: some apps block person-to-person links that come with an amount.
- `note` is cut to 50 characters.

The builders throw a `RangeError` for a malformed UPI ID or amount.

`app` is one of `'phonepe' | 'gpay' | 'paytm' | 'cred' | 'bhim'`. `UPI_APPS` lists each with its display name, Android package and iPhone scheme.

### `detectDevice(userAgent?, maxTouchPoints?)`

`'android' | 'ios' | 'desktop'`. Reads `navigator` by default. Counts iPads that report a Mac user agent as `'ios'`.

### `openUpiApp(app, input, options?)`

Opens the app and returns `true`, or returns `false` on desktop without doing anything.

| Option | Default | |
| --- | --- | --- |
| `device` | `detectDevice()` | |
| `onNotInstalled` | | iPhone only. Called when the page is still visible after `graceMs`. On Android, Chrome opens the Play Store instead. |
| `graceMs` | `1500` | |
| `navigate` | `location.href = url` | |

### `createPaymentCheck(options)`

| Option | Default | |
| --- | --- | --- |
| `onReturn(attempt)` | required | `attempt` is `{ data, startedAt, leftAt? }` |
| `storageKey` | `'upi-handoff:attempt'` | |
| `leaveWindowMs` | 5 minutes | Leaving later than this after `start()` doesn't count as going to the UPI app. |
| `maxAgeMs` | 2 hours | Attempts older than this are dropped. |
| `minAwayMs` | 800 ms | Coming back sooner than this means the app didn't open. |

Returns `{ start(data), ask(data), pending(), clear(), destroy() }`. `data` must be JSON-serialisable: it's kept in `localStorage`, with an in-memory fallback when storage is blocked.

## Limits

- This can't confirm a payment. Only the payer, or your payment provider, knows whether it went through. Treat the answer to "Did you pay?" as the payer's word.
- App schemes and package names are the ones these apps use as of 2026. If one changes, please open an issue.

## Contributing

Issues and pull requests are welcome, especially for apps that aren't listed yet or behave differently on some phones. Please say which phone, OS version and browser you tested on.

```bash
npm install
npm test
```

## Licence

MIT
