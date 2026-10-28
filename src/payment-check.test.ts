import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPaymentCheck, type PaymentCheck } from './payment-check';

const MIN = 60 * 1000;
const data = { tripId: 't', toName: 'Riya', amountPaise: 30000 };
type Data = typeof data;

let clock = 1_000_000;
let check: PaymentCheck<Data> | null = null;

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function create(onReturn = vi.fn()) {
  check = createPaymentCheck<Data>({ onReturn, now: () => clock });
  return { check, onReturn };
}

describe('createPaymentCheck', () => {
  beforeEach(() => {
    clock = 1_000_000;
    localStorage.clear();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
  afterEach(() => {
    check?.destroy();
    check = null;
  });

  it('asks when they come back from the UPI app', () => {
    const { check, onReturn } = create();
    check.start(data);
    clock += 1000;
    setVisibility('hidden');
    clock += 30 * 1000;
    setVisibility('visible');
    expect(onReturn).toHaveBeenCalledOnce();
    expect(onReturn.mock.calls[0]![0]).toMatchObject({ data, startedAt: 1_000_000, leftAt: 1_001_000 });
  });

  it("doesn't ask when they only bounced back (the app didn't open)", () => {
    const { check, onReturn } = create();
    check.start(data);
    setVisibility('hidden');
    clock += 300;
    setVisibility('visible');
    expect(onReturn).not.toHaveBeenCalled();
  });

  it("doesn't ask if they never left", () => {
    const { check, onReturn } = create();
    check.start(data);
    clock += MIN;
    setVisibility('visible');
    expect(onReturn).not.toHaveBeenCalled();
  });

  it('still asks after the page reloaded while the UPI app was open', () => {
    const first = create();
    first.check.start(data);
    setVisibility('hidden');
    first.check.destroy();
    clock += 2 * MIN;
    // The reloaded page starts out visible.
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    const { onReturn } = create();
    expect(onReturn).toHaveBeenCalledOnce();
    expect(onReturn.mock.calls[0]![0].data).toEqual(data);
  });

  it('ignores leaving the page long after the tap', () => {
    const { check, onReturn } = create();
    check.start(data);
    clock += 6 * MIN;
    setVisibility('hidden');
    clock += MIN;
    setVisibility('visible');
    expect(onReturn).not.toHaveBeenCalled();
    expect(check.pending()).toBeNull();
  });

  it('keeps it for two hours after they left, then forgets it', () => {
    const { check } = create();
    check.start(data);
    setVisibility('hidden');
    clock += 90 * MIN;
    expect(check.pending()?.data).toEqual(data);
    clock += 31 * MIN;
    expect(check.pending()).toBeNull();
  });

  it('asks right away with ask()', () => {
    const { check, onReturn } = create();
    check.ask(data);
    expect(onReturn).toHaveBeenCalledWith({ data, startedAt: clock });
  });

  it('stops asking after clear()', () => {
    const { check, onReturn } = create();
    check.start(data);
    setVisibility('hidden');
    clock += MIN;
    check.clear();
    setVisibility('visible');
    expect(onReturn).not.toHaveBeenCalled();
    expect(check.pending()).toBeNull();
  });

  it('works when localStorage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { check, onReturn } = create();
    check.start(data);
    setVisibility('hidden');
    clock += MIN;
    setVisibility('visible');
    expect(onReturn).toHaveBeenCalledOnce();
    spy.mockRestore();
    set.mockRestore();
  });
});
