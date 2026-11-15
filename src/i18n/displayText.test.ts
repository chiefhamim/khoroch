import { localizeDisplayText } from './displayText';

describe('localizeDisplayText Bangla time-of-day and labels', () => {
  it('converts English meridiem timestamps to natural Bangladeshi day periods', () => {
    expect(localizeDisplayText('আজ, 4:30 AM', 'bn')).toBe('আজ, ভোর ৪:৩০');
    expect(localizeDisplayText('আজ, 9:15 AM', 'bn')).toBe('আজ, সকাল ৯:১৫');
    expect(localizeDisplayText('আজ, 1:45 PM', 'bn')).toBe('আজ, দুপুর ১:৪৫');
    expect(localizeDisplayText('আজ, 4:20 PM', 'bn')).toBe('আজ, বিকেল ৪:২০');
    expect(localizeDisplayText('আজ, 5:11 PM', 'bn')).toBe('আজ, সন্ধ্যা ৫:১১');
    expect(localizeDisplayText('আজ, 10:05 PM', 'bn')).toBe('আজ, রাত ১০:০৫');
    expect(localizeDisplayText('আজ, 12:30 AM', 'bn')).toBe('আজ, রাত ১২:৩০');
  });

  it('leaves English display text untouched', () => {
    expect(localizeDisplayText('Today, 5:11 PM', 'en')).toBe('Today, 5:11 PM');
  });
});
