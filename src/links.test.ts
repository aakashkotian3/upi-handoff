import { describe, expect, it } from 'vitest';

import { buildUpiAndroidIntent, buildUpiAppLink, buildUpiLink, formatUpiAmount, isUpiId, UPI_APPS } from './links';

describe('formatUpiAmount', () => {
  it('always has exactly two decimals', () => {
    expect(formatUpiAmount(1000)).toBe('10.00');
    expect(formatUpiAmount(12345)).toBe('123.45');
    expect(formatUpiAmount(5)).toBe('0.05');
    expect(formatUpiAmount(10000000)).toBe('100000.00');
  });

  it('rejects non-positive or fractional paise', () => {
    expect(() => formatUpiAmount(0)).toThrow();
    expect(() => formatUpiAmount(-100)).toThrow();
    expect(() => formatUpiAmount(10.5)).toThrow();
  });
});

describe('isUpiId', () => {
  it('accepts name@handle and rejects the rest', () => {
    expect(isUpiId('lokesh@okaxis')).toBe(true);
    expect(isUpiId('9876543210@ybl')).toBe(true);
    expect(isUpiId(' riya.s@oksbi ')).toBe(true);
    expect(isUpiId('lokesh')).toBe(false);
    expect(isUpiId('lokesh@ok axis')).toBe(false);
    expect(isUpiId('@okaxis')).toBe(false);
  });
});

describe('buildUpiLink', () => {
  const input = { upiId: 'lokesh@okaxis', name: 'Lokesh', amountPaise: 1000, note: 'Goa 2026 settle up' };

  it('builds the canonical upi://pay link', () => {
    expect(buildUpiLink(input)).toBe(
      'upi://pay?pa=lokesh@okaxis&pn=Lokesh&am=10.00&cu=INR&tn=Goa%202026%20settle%20up',
    );
  });

  it('leaves out am when no amount is given, so the payer types it', () => {
    const { amountPaise: _omit, ...noAmount } = input;
    void _omit;
    expect(buildUpiLink(noAmount)).toBe('upi://pay?pa=lokesh@okaxis&pn=Lokesh&cu=INR&tn=Goa%202026%20settle%20up');
  });

  it('allows leaving out the note', () => {
    expect(buildUpiLink({ upiId: 'lokesh@okaxis', name: 'Lokesh' })).toBe('upi://pay?pa=lokesh@okaxis&pn=Lokesh&cu=INR&tn=');
  });

  it('never percent-encodes the @ in pa', () => {
    expect(buildUpiLink(input)).toContain('pa=lokesh@okaxis&');
    expect(buildUpiLink(input)).not.toContain('%40');
  });

  it('encodes pn and tn', () => {
    const link = buildUpiLink({ ...input, name: 'Shetty & Co', note: 'chai/maggi settle up' });
    expect(link).toContain('pn=Shetty%20%26%20Co');
    expect(link).toContain('tn=chai%2Fmaggi%20settle%20up');
  });

  it('trims the UPI id and rejects malformed ones', () => {
    expect(buildUpiLink({ ...input, upiId: '  lokesh@okaxis ' })).toContain('pa=lokesh@okaxis&');
    expect(() => buildUpiLink({ ...input, upiId: 'lokesh' })).toThrow();
    expect(() => buildUpiLink({ ...input, upiId: 'lokesh@ok axis' })).toThrow();
  });

  it('caps the note at 50 characters', () => {
    const link = buildUpiLink({ ...input, note: 'x'.repeat(80) });
    expect(decodeURIComponent(link.split('tn=')[1]!)).toHaveLength(50);
  });
});

describe('buildUpiAppLink', () => {
  const input = { upiId: 'lokesh@okaxis', name: 'Lokesh', amountPaise: 1000, note: 'Goa settle up' };
  it('uses the same query with app-specific schemes', () => {
    const q = 'pa=lokesh@okaxis&pn=Lokesh&am=10.00&cu=INR&tn=Goa%20settle%20up';
    expect(buildUpiAppLink('phonepe', input)).toBe(`phonepe://pay?${q}`);
    expect(buildUpiAppLink('gpay', input)).toBe(`tez://upi/pay?${q}`);
    expect(buildUpiAppLink('paytm', input)).toBe(`paytmmp://pay?${q}`);
    expect(buildUpiAppLink('cred', input)).toBe(`credpay://upi/pay?${q}`);
    expect(buildUpiAppLink('bhim', input)).toBe(`bhim://upi/pay?${q}`);
  });
  it('rejects an unknown app', () => {
    expect(() => buildUpiAppLink('whatsapp' as never, input)).toThrow();
  });
});

describe('buildUpiAndroidIntent', () => {
  const input = { upiId: 'shetty@okaxis', name: 'Shetty', note: 'Goa settle up' };
  it('targets the chosen app package so WhatsApp (a default UPI handler) is skipped', () => {
    expect(buildUpiAndroidIntent('phonepe', input)).toBe(
      'intent://pay?pa=shetty@okaxis&pn=Shetty&cu=INR&tn=Goa%20settle%20up#Intent;scheme=upi;package=com.phonepe.app;end',
    );
    expect(buildUpiAndroidIntent('gpay', input)).toContain('package=com.google.android.apps.nbu.paisa.user;end');
    expect(buildUpiAndroidIntent('paytm', input)).toContain('package=net.one97.paytm;end');
    expect(buildUpiAndroidIntent('cred', input)).toContain('package=com.dreamplug.androidapp;end');
    expect(buildUpiAndroidIntent('bhim', input)).toContain('package=in.org.npci.upiapp;end');
  });
  it('keeps the UPI id unencoded and carries the amount when given', () => {
    const url = buildUpiAndroidIntent('gpay', { ...input, amountPaise: 12000 });
    expect(url).toContain('pa=shetty@okaxis&');
    expect(url).toContain('&am=120.00&cu=INR');
    expect(buildUpiAndroidIntent('gpay', input)).not.toContain('am=');
  });
});

describe('UPI_APPS', () => {
  it('lists each app once', () => {
    expect(new Set(UPI_APPS.map((a) => a.id)).size).toBe(UPI_APPS.length);
  });
});
