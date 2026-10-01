import { describe, it, expect } from 'vitest';
import {
  isOpenAt,
  nextOpening,
  isValidTimeOfDay,
  isValidTimeZone,
  localDayOfWeek,
  weeklyScheduleSchema,
  type WeeklySchedule,
} from './schedule.js';

// 2026-10-04 is a Sunday, so 2026-10-05 is Monday ... 2026-10-10 is Saturday.
const BOGOTA = 'America/Bogota'; // UTC-5, no DST
const UTC = 'UTC';

// Builds the UTC instant for a Bogota wall-clock time on a given October 2026 day.
const bogota = (day: number, time: string) => new Date(`2026-10-${String(day).padStart(2, '0')}T${time}:00-05:00`);

// Mon-Sun 12:00-22:30
const everyDay: WeeklySchedule = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  open: '12:00',
  close: '22:30',
}));

describe('isOpenAt', () => {
  it('is open inside a range and closed outside it', () => {
    expect(isOpenAt(everyDay, bogota(5, '12:00'), BOGOTA)).toBe(true);
    expect(isOpenAt(everyDay, bogota(5, '18:00'), BOGOTA)).toBe(true);
    expect(isOpenAt(everyDay, bogota(5, '22:29'), BOGOTA)).toBe(true);
    expect(isOpenAt(everyDay, bogota(5, '11:59'), BOGOTA)).toBe(false);
    expect(isOpenAt(everyDay, bogota(5, '03:00'), BOGOTA)).toBe(false);
  });

  it('treats the close time as exclusive', () => {
    expect(isOpenAt(everyDay, bogota(5, '22:30'), BOGOTA)).toBe(false);
  });

  it('only applies a range to its own weekday', () => {
    const mondayOnly: WeeklySchedule = [{ dayOfWeek: 1, open: '09:00', close: '17:00' }];
    expect(isOpenAt(mondayOnly, bogota(5, '10:00'), BOGOTA)).toBe(true); // Monday
    expect(isOpenAt(mondayOnly, bogota(6, '10:00'), BOGOTA)).toBe(false); // Tuesday
    expect(isOpenAt(mondayOnly, bogota(4, '10:00'), BOGOTA)).toBe(false); // Sunday
  });

  it('is closed all day when the weekday has no ranges', () => {
    const noSunday = everyDay.filter((r) => r.dayOfWeek !== 0);
    expect(isOpenAt(noSunday, bogota(4, '15:00'), BOGOTA)).toBe(false);
    expect(isOpenAt(noSunday, bogota(5, '15:00'), BOGOTA)).toBe(true);
  });

  it('is always closed for an empty schedule', () => {
    expect(isOpenAt([], bogota(5, '15:00'), BOGOTA)).toBe(false);
  });

  it('supports multiple ranges per day', () => {
    const split: WeeklySchedule = [
      { dayOfWeek: 2, open: '11:00', close: '14:00' },
      { dayOfWeek: 2, open: '18:00', close: '23:00' },
    ];
    expect(isOpenAt(split, bogota(6, '12:00'), BOGOTA)).toBe(true);
    expect(isOpenAt(split, bogota(6, '15:00'), BOGOTA)).toBe(false);
    expect(isOpenAt(split, bogota(6, '19:00'), BOGOTA)).toBe(true);
  });

  describe('overnight ranges (close <= open)', () => {
    const mondayNight: WeeklySchedule = [{ dayOfWeek: 1, open: '20:00', close: '02:00' }];

    it('is open from the opening time until midnight on the same day', () => {
      expect(isOpenAt(mondayNight, bogota(5, '19:59'), BOGOTA)).toBe(false);
      expect(isOpenAt(mondayNight, bogota(5, '20:00'), BOGOTA)).toBe(true);
      expect(isOpenAt(mondayNight, bogota(5, '23:59'), BOGOTA)).toBe(true);
    });

    it('stays open into the next day until the close time', () => {
      expect(isOpenAt(mondayNight, bogota(6, '00:00'), BOGOTA)).toBe(true);
      expect(isOpenAt(mondayNight, bogota(6, '01:00'), BOGOTA)).toBe(true);
      expect(isOpenAt(mondayNight, bogota(6, '01:59'), BOGOTA)).toBe(true);
      expect(isOpenAt(mondayNight, bogota(6, '02:00'), BOGOTA)).toBe(false);
    });

    it('does not open the previous day', () => {
      expect(isOpenAt(mondayNight, bogota(4, '23:00'), BOGOTA)).toBe(false); // Sunday night
      expect(isOpenAt(mondayNight, bogota(5, '01:00'), BOGOTA)).toBe(false); // Monday early morning
    });

    it('wraps from Saturday into Sunday', () => {
      const saturdayNight: WeeklySchedule = [{ dayOfWeek: 6, open: '22:00', close: '03:00' }];
      expect(isOpenAt(saturdayNight, bogota(10, '23:00'), BOGOTA)).toBe(true); // Saturday
      expect(isOpenAt(saturdayNight, bogota(11, '02:30'), BOGOTA)).toBe(true); // Sunday
      expect(isOpenAt(saturdayNight, bogota(11, '03:00'), BOGOTA)).toBe(false);
    });

    it('treats close == open as a full 24 hour range ending the next day', () => {
      const allDay: WeeklySchedule = [{ dayOfWeek: 3, open: '00:00', close: '00:00' }];
      expect(isOpenAt(allDay, bogota(7, '00:00'), BOGOTA)).toBe(true);
      expect(isOpenAt(allDay, bogota(7, '23:59'), BOGOTA)).toBe(true);
      expect(isOpenAt(allDay, bogota(8, '00:00'), BOGOTA)).toBe(false);
    });
  });

  describe('timezone', () => {
    const lunch: WeeklySchedule = [{ dayOfWeek: 1, open: '12:00', close: '14:00' }];

    it('evaluates the same instant differently per timezone', () => {
      // 2026-10-05T18:00Z = Monday 13:00 in Bogota, Monday 18:00 in UTC
      const instant = new Date('2026-10-05T18:00:00Z');
      expect(isOpenAt(lunch, instant, BOGOTA)).toBe(true);
      expect(isOpenAt(lunch, instant, UTC)).toBe(false);
    });

    it('uses the restaurant weekday, not the server weekday', () => {
      // 2026-10-06T03:00Z is Tuesday in UTC but still Monday 22:00 in Bogota
      const lateMonday: WeeklySchedule = [{ dayOfWeek: 1, open: '20:00', close: '23:00' }];
      const instant = new Date('2026-10-06T03:00:00Z');
      expect(isOpenAt(lateMonday, instant, BOGOTA)).toBe(true);
      expect(isOpenAt(lateMonday, instant, UTC)).toBe(false);
    });
  });
});

describe('nextOpening', () => {
  it('returns null for an empty schedule', () => {
    expect(nextOpening([], bogota(5, '10:00'), BOGOTA)).toBeNull();
  });

  it('returns a later opening on the same day', () => {
    expect(nextOpening(everyDay, bogota(5, '09:00'), BOGOTA)).toEqual({
      dayOfWeek: 1,
      time: '12:00',
      daysAhead: 0,
    });
  });

  it('returns the next day when todays ranges already started', () => {
    expect(nextOpening(everyDay, bogota(5, '23:00'), BOGOTA)).toEqual({
      dayOfWeek: 2,
      time: '12:00',
      daysAhead: 1,
    });
  });

  it('skips closed days', () => {
    const onlyFriday: WeeklySchedule = [{ dayOfWeek: 5, open: '17:00', close: '23:00' }];
    expect(nextOpening(onlyFriday, bogota(5, '10:00'), BOGOTA)).toEqual({
      dayOfWeek: 5,
      time: '17:00',
      daysAhead: 4,
    });
  });

  it('wraps past Saturday into the next week', () => {
    const mondayOnly: WeeklySchedule = [{ dayOfWeek: 1, open: '09:00', close: '17:00' }];
    expect(nextOpening(mondayOnly, bogota(10, '12:00'), BOGOTA)).toEqual({
      dayOfWeek: 1,
      time: '09:00',
      daysAhead: 2,
    });
  });

  it('returns the same weekday next week when the only range already started today', () => {
    const mondayOnly: WeeklySchedule = [{ dayOfWeek: 1, open: '09:00', close: '17:00' }];
    expect(nextOpening(mondayOnly, bogota(5, '10:00'), BOGOTA)).toEqual({
      dayOfWeek: 1,
      time: '09:00',
      daysAhead: 7,
    });
  });

  it('picks the earliest of several ranges on a day', () => {
    const split: WeeklySchedule = [
      { dayOfWeek: 1, open: '18:00', close: '23:00' },
      { dayOfWeek: 1, open: '11:00', close: '14:00' },
    ];
    expect(nextOpening(split, bogota(5, '09:00'), BOGOTA)).toEqual({ dayOfWeek: 1, time: '11:00', daysAhead: 0 });
    expect(nextOpening(split, bogota(5, '15:00'), BOGOTA)).toEqual({ dayOfWeek: 1, time: '18:00', daysAhead: 0 });
  });

  it('uses the restaurant timezone to decide what today is', () => {
    const tuesdayOnly: WeeklySchedule = [{ dayOfWeek: 2, open: '09:00', close: '17:00' }];
    // 2026-10-06T03:00Z is Tuesday in UTC, Monday 22:00 in Bogota
    const instant = new Date('2026-10-06T03:00:00Z');
    expect(nextOpening(tuesdayOnly, instant, BOGOTA)).toEqual({ dayOfWeek: 2, time: '09:00', daysAhead: 1 });
    expect(nextOpening(tuesdayOnly, instant, UTC)).toEqual({ dayOfWeek: 2, time: '09:00', daysAhead: 0 });
  });
});

describe('validators', () => {
  it('validates HH:MM times', () => {
    for (const ok of ['00:00', '09:05', '12:00', '23:59']) expect(isValidTimeOfDay(ok)).toBe(true);
    for (const bad of ['24:00', '9:00', '12:60', '12:00:00', '', 'ab:cd', '12-00']) {
      expect(isValidTimeOfDay(bad)).toBe(false);
    }
  });

  it('validates IANA timezones through Intl', () => {
    expect(isValidTimeZone('America/Bogota')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('weeklyScheduleSchema accepts valid ranges and rejects bad day or time values', () => {
    expect(weeklyScheduleSchema.safeParse([{ dayOfWeek: 0, open: '12:00', close: '22:30' }]).success).toBe(true);
    expect(weeklyScheduleSchema.safeParse([]).success).toBe(true);
    expect(weeklyScheduleSchema.safeParse([{ dayOfWeek: 7, open: '12:00', close: '22:30' }]).success).toBe(false);
    expect(weeklyScheduleSchema.safeParse([{ dayOfWeek: -1, open: '12:00', close: '22:30' }]).success).toBe(false);
    expect(weeklyScheduleSchema.safeParse([{ dayOfWeek: 1.5, open: '12:00', close: '22:30' }]).success).toBe(false);
    expect(weeklyScheduleSchema.safeParse([{ dayOfWeek: 1, open: '25:00', close: '22:30' }]).success).toBe(false);
    expect(weeklyScheduleSchema.safeParse([{ dayOfWeek: 1, open: '12:00', close: 'late' }]).success).toBe(false);
  });
});

describe('localDayOfWeek', () => {
  it('returns the weekday of the instant in the given timezone (0 = Sunday)', () => {
    // 2026-10-06T03:00Z is Tuesday in UTC, Monday 22:00 in Bogota
    const instant = new Date('2026-10-06T03:00:00Z');
    expect(localDayOfWeek(instant, UTC)).toBe(2);
    expect(localDayOfWeek(instant, BOGOTA)).toBe(1);
    expect(localDayOfWeek(bogota(4, '12:00'), BOGOTA)).toBe(0);
  });
});
