import {
  REMINDER_NOTIFICATION_CONTENT,
  WEEKDAY_NUMBERS,
  buildReminderTriggerSpecs,
  parseReminderTime,
} from './reminders';

describe('reminders pure scheduling', () => {
  it('parses valid HH:mm strings and rejects invalid ones', () => {
    expect(parseReminderTime('21:00')).toEqual({ hour: 21, minute: 0 });
    expect(parseReminderTime('00:05')).toEqual({ hour: 0, minute: 5 });
    expect(parseReminderTime('23:59')).toEqual({ hour: 23, minute: 59 });

    expect(parseReminderTime('24:00')).toBeNull();
    expect(parseReminderTime('21:60')).toBeNull();
    expect(parseReminderTime('9:00')).toBeNull();
    expect(parseReminderTime('abc')).toBeNull();
    expect(parseReminderTime('')).toBeNull();
  });

  it('builds 1 daily trigger for everyday and 5 weekly triggers (Mon-Fri) for weekdays', () => {
    expect(
      buildReminderTriggerSpecs({
        enabled: true,
        time: '21:30',
        days: 'everyday',
      })
    ).toEqual([{ kind: 'daily', hour: 21, minute: 30 }]);

    const weekdays = buildReminderTriggerSpecs({
      enabled: true,
      time: '20:15',
      days: 'weekdays',
    });
    expect(weekdays).toHaveLength(5);
    expect(weekdays).toEqual(
      WEEKDAY_NUMBERS.map((weekday) => ({
        kind: 'weekly',
        weekday,
        hour: 20,
        minute: 15,
      }))
    );
  });

  it('returns empty trigger list when disabled or invalid time (cancels all)', () => {
    expect(
      buildReminderTriggerSpecs({
        enabled: false,
        time: '21:00',
        days: 'everyday',
      })
    ).toEqual([]);

    expect(
      buildReminderTriggerSpecs({
        enabled: false,
        time: '21:00',
        days: 'weekdays',
      })
    ).toEqual([]);

    expect(
      buildReminderTriggerSpecs({
        enabled: true,
        time: '99:99',
        days: 'everyday',
      })
    ).toEqual([]);
  });

  it('notification content never contains amounts, digits, or currency symbols', () => {
    const combined = `${REMINDER_NOTIFICATION_CONTENT.title} ${REMINDER_NOTIFICATION_CONTENT.body}`;
    expect(combined).not.toMatch(/\d/);
    expect(combined).not.toMatch(/[৳$€]/);
    expect(REMINDER_NOTIFICATION_CONTENT.data.route).toBe('/check-in');
  });
});
