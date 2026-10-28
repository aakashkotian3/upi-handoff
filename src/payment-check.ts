/**
 * "Did you pay?" after someone comes back from a UPI app.
 *
 * A web page can't see whether the payment went through, so the next best
 * thing is to ask as soon as the payer is back. The attempt is kept in
 * localStorage so it still asks when the phone reloaded the page while the UPI
 * app was open, or when the app reopens on a different screen: create the
 * check somewhere that's mounted on every page, like a root layout.
 */

export interface PaymentAttempt<T> {
  /** Whatever you need to show the prompt and record the payment. Must be JSON-serialisable. */
  data: T;
  /** When they tapped the UPI app (ms). */
  startedAt: number;
  /** When the page was hidden for the UPI app (ms). Unset until then. */
  leftAt?: number;
}

export interface PaymentCheckOptions<T> {
  /**
   * Show your "Did you pay?" prompt. It can be called again for the same
   * attempt (say, after another app switch) until you call `clear()`, so
   * showing it should be idempotent.
   */
  onReturn: (attempt: PaymentAttempt<T>) => void;
  /** Default "upi-handoff:attempt". Use different keys for separate checks. */
  storageKey?: string;
  /** Leaving the page later than this after `start()` isn't a trip to the UPI app. Default 5 minutes. */
  leaveWindowMs?: number;
  /** Older than this, it's not the payment they were just making. Default 2 hours. */
  maxAgeMs?: number;
  /** Coming back sooner than this is a bounce (the app didn't open), not a payment. Default 800 ms. */
  minAwayMs?: number;
  /** Defaults to `Date.now`. */
  now?: () => number;
}

export interface PaymentCheck<T> {
  /** Call right before opening the UPI app (or showing a QR to scan with another phone app). */
  start(data: T): void;
  /** Save it and ask now, without waiting for a trip to another app. For an "I've paid" button. */
  ask(data: T): void;
  /** The attempt still waiting for an answer, if any. */
  pending(): PaymentAttempt<T> | null;
  /** Call once the payer answers, either way. */
  clear(): void;
  /** Remove the page listeners. */
  destroy(): void;
}

export const LEAVE_WINDOW_MS = 5 * 60 * 1000;
export const MAX_AGE_MS = 2 * 60 * 60 * 1000;
export const MIN_AWAY_MS = 800;

export function createPaymentCheck<T>(options: PaymentCheckOptions<T>): PaymentCheck<T> {
  const {
    onReturn,
    storageKey = 'upi-handoff:attempt',
    leaveWindowMs = LEAVE_WINDOW_MS,
    maxAgeMs = MAX_AGE_MS,
    minAwayMs = MIN_AWAY_MS,
    now = Date.now,
  } = options;

  // Fallback for blocked storage: works while the page stays alive.
  let memo: PaymentAttempt<T> | null = null;

  const save = (attempt: PaymentAttempt<T>) => {
    memo = attempt;
    try {
      localStorage.setItem(storageKey, JSON.stringify(attempt));
    } catch {
      // Blocked storage: `memo` still has it.
    }
  };

  const clear = () => {
    memo = null;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Nothing to clear.
    }
  };

  const pending = (): PaymentAttempt<T> | null => {
    let a = memo;
    try {
      const raw = localStorage.getItem(storageKey);
      a = raw ? (JSON.parse(raw) as PaymentAttempt<T>) : null;
    } catch {
      // Blocked or corrupt storage: fall back to `memo`.
    }
    if (!a) return null;
    const t = now();
    const stale = t - (a.leftAt ?? a.startedAt) > maxAgeMs || (a.leftAt === undefined && t - a.startedAt > leaveWindowMs);
    if (stale) {
      clear();
      return null;
    }
    return a;
  };

  const check = () => {
    const a = pending();
    if (!a) return;
    const t = now();
    if (document.visibilityState === 'hidden') {
      // Off to the UPI app: stamp it, unless this is long after they tapped.
      if (a.leftAt === undefined && t - a.startedAt <= leaveWindowMs) save({ ...a, leftAt: t });
    } else if (a.leftAt !== undefined && t - a.leftAt >= minAwayMs) {
      onReturn(a);
    }
  };

  check();
  document.addEventListener('visibilitychange', check);
  // A reloaded page on iOS can come back through bfcache without a visibility change.
  window.addEventListener('pageshow', check);

  return {
    start: (data) => save({ data, startedAt: now() }),
    ask: (data) => {
      const attempt = { data, startedAt: now() };
      save(attempt);
      onReturn(attempt);
    },
    pending,
    clear,
    destroy: () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('pageshow', check);
    },
  };
}
