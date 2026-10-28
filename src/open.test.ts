import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openUpiApp } from './open';

const input = { upiId: 'riya@okaxis', name: 'Riya', amountPaise: 30000, note: 'Goa' };

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

describe('openUpiApp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => vi.useRealTimers());

  it('opens an intent URL for that exact app on Android', () => {
    const navigate = vi.fn();
    expect(openUpiApp('phonepe', input, { device: 'android', navigate })).toBe(true);
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^intent:\/\/pay\?.*package=com\.phonepe\.app;end$/));
  });

  it("opens the app's own scheme on iPhone", () => {
    const navigate = vi.fn();
    openUpiApp('gpay', input, { device: 'ios', navigate });
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^tez:\/\/upi\/pay\?pa=riya@okaxis&/));
  });

  it('reports a missing app on iPhone when the page is still visible', () => {
    const onNotInstalled = vi.fn();
    openUpiApp('cred', input, { device: 'ios', navigate: () => {}, onNotInstalled });
    vi.advanceTimersByTime(1499);
    expect(onNotInstalled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onNotInstalled).toHaveBeenCalledOnce();
  });

  it('stays quiet when the app opened and the page went to the background', () => {
    const onNotInstalled = vi.fn();
    openUpiApp('cred', input, { device: 'ios', navigate: () => setVisibility('hidden'), onNotInstalled });
    vi.advanceTimersByTime(2000);
    expect(onNotInstalled).not.toHaveBeenCalled();
  });

  it('does nothing on desktop', () => {
    const navigate = vi.fn();
    expect(openUpiApp('paytm', input, { device: 'desktop', navigate })).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
