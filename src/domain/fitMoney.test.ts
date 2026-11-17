import { typography } from '@/theme/tokens';
import { estimateMoneyWidth, fitMoney, formatNumberPart, MIN_FIT_FONT_SIZE } from './fitMoney';

const VARIANTS = [
  { key: 'display', fontSize: typography.display.fontSize },
  { key: 'title', fontSize: typography.title.fontSize },
  { key: 'headline', fontSize: typography.headline.fontSize },
] as const;

// 1,234,567 taka: 7 digits + 2 commas
const BIG = 123_456_700;

const base = {
  amountMinor: BIG,
  variants: VARIANTS,
  bangla: false,
  compact: false,
  showDecimals: false,
  roundToWhole: false,
};

describe('fitMoney', () => {
  it('keeps the first variant when it fits', () => {
    expect(fitMoney({ ...base, availableWidth: 200 })).toEqual({
      variant: 'display',
      fontSize: 34,
      compact: false,
    });
  });

  it('steps down one variant', () => {
    expect(fitMoney({ ...base, availableWidth: 150 })).toMatchObject({
      variant: 'title',
      compact: false,
    });
  });

  it('steps down two variants', () => {
    expect(fitMoney({ ...base, availableWidth: 100 })).toMatchObject({
      variant: 'headline',
      compact: false,
    });
  });

  it('falls back to the smallest variant with compact formatting', () => {
    expect(fitMoney({ ...base, availableWidth: 60 })).toEqual({
      variant: 'headline',
      fontSize: 17,
      compact: true,
    });
  });

  it('measures Bangla digits wider than Latin', () => {
    const latin = estimateMoneyWidth('1,234,567', 34, { bangla: false, negative: false });
    const bn = estimateMoneyWidth('1,234,567', 34, { bangla: true, negative: false });
    expect(bn).toBeGreaterThan(latin);
    expect(fitMoney({ ...base, availableWidth: 180 }).variant).toBe('display');
    expect(fitMoney({ ...base, bangla: true, availableWidth: 180 }).variant).toBe('title');
  });

  it('accounts for the minus sign of a negative amount', () => {
    expect(fitMoney({ ...base, availableWidth: 190 }).variant).toBe('display');
    expect(fitMoney({ ...base, amountMinor: -BIG, availableWidth: 190 }).variant).toBe('title');
  });

  it('fits zero at the first variant in a narrow slot', () => {
    expect(fitMoney({ ...base, amountMinor: 0, availableWidth: 40 })).toMatchObject({
      variant: 'display',
      compact: false,
    });
  });

  it('returns the first variant unchanged when width is 0 or unknown', () => {
    for (const w of [0, -5, NaN, undefined, null]) {
      expect(fitMoney({ ...base, availableWidth: w })).toEqual({
        variant: 'display',
        fontSize: 34,
        compact: false,
      });
    }
    expect(fitMoney({ ...base, compact: true, availableWidth: 0 }).compact).toBe(true);
  });

  it('never goes below the label size', () => {
    const result = fitMoney({
      ...base,
      variants: [...VARIANTS, { key: 'tiny', fontSize: 10 }],
      availableWidth: 10,
    });
    expect(result.fontSize).toBeGreaterThanOrEqual(MIN_FIT_FONT_SIZE);
    expect(result.variant).toBe('headline');
    expect(result.compact).toBe(true);
  });

  it('keeps compact when the caller already asked for it', () => {
    expect(fitMoney({ ...base, compact: true, availableWidth: 200 }).compact).toBe(true);
  });
});

describe('formatNumberPart', () => {
  const opts = { compact: false, showDecimals: false, roundToWhole: false };
  it('groups thousands and hides .00', () => {
    expect(formatNumberPart(123_456_700, opts)).toEqual({
      numberPart: '1,234,567',
      isNegative: false,
    });
  });
  it('shows poisha when present or requested', () => {
    expect(formatNumberPart(12_550, opts).numberPart).toBe('125.50');
    expect(formatNumberPart(12_500, { ...opts, showDecimals: true }).numberPart).toBe('125.00');
  });
  it('flags negatives and supports compact', () => {
    expect(formatNumberPart(-4_835_000, { ...opts, compact: true })).toEqual({
      numberPart: '48.4k',
      isNegative: true,
    });
  });
});
