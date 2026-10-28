import { describe, expect, it } from 'vitest';

import { detectDevice } from './device';

describe('detectDevice', () => {
  it('detects Android phones', () => {
    expect(
      detectDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36'),
    ).toBe('android');
  });
  it('detects iPhone and iPad', () => {
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1')).toBe('ios');
    expect(detectDevice('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) Safari/604.1')).toBe('ios');
    // iPadOS masquerading as a Mac, but with touch.
    expect(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 5)).toBe('ios');
  });
  it('treats everything else as desktop', () => {
    expect(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 0)).toBe('desktop');
    expect(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124')).toBe('desktop');
  });
});
