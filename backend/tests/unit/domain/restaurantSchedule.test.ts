import { describe, it, expect } from 'vitest';
import { ValidationError } from '../../../src/domain/errors/DomainErrors.js';
import {
  DEFAULT_TIMEZONE,
  defaultWeeklySchedule,
  legacyOpeningHours,
  legacyHoursText,
  scheduleFromLegacyHoursText,
  sortSchedule,
  assertValidSchedule,
  assertValidTimezone,
} from '../../../src/domain/shared/restaurantSchedule.js';

describe('restaurant schedule helpers', () => {
  it('defaults to Bogota and a 12:00-22:30 range on all 7 days', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Bogota');
    const schedule = defaultWeeklySchedule();
    expect(schedule).toHaveLength(7);
    expect(schedule.map((r) => r.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(schedule.every((r) => r.open === '12:00' && r.close === '22:30')).toBe(true);
  });

  it('sorts ranges by weekday then opening time', () => {
    const sorted = sortSchedule([
      { dayOfWeek: 2, open: '18:00', close: '23:00' },
      { dayOfWeek: 1, open: '12:00', close: '15:00' },
      { dayOfWeek: 2, open: '11:00', close: '14:00' },
    ]);
    expect(sorted.map((r) => `${r.dayOfWeek}@${r.open}`)).toEqual(['1@12:00', '2@11:00', '2@18:00']);
  });

  describe('legacyOpeningHours', () => {
    const schedule = [
      { dayOfWeek: 1, open: '09:00', close: '17:00' },
      { dayOfWeek: 3, open: '10:00', close: '20:00' },
      { dayOfWeek: 3, open: '21:00', close: '23:00' },
    ];

    it("uses today's first range in the restaurant timezone", () => {
      // Wednesday 2026-10-07 12:00 Bogota
      const now = new Date('2026-10-07T12:00:00-05:00');
      expect(legacyOpeningHours(schedule, 'America/Bogota', now)).toEqual({ open: '10:00', close: '20:00' });
    });

    it('falls back to the first range of the week when today is closed', () => {
      // Thursday 2026-10-08
      const now = new Date('2026-10-08T12:00:00-05:00');
      expect(legacyOpeningHours(schedule, 'America/Bogota', now)).toEqual({ open: '09:00', close: '17:00' });
    });

    it('is undefined for an empty schedule', () => {
      expect(legacyOpeningHours([], 'America/Bogota', new Date())).toBeUndefined();
    });
  });

  it('renders the legacy "HH:MM - HH:MM" text, empty when there is no range', () => {
    expect(legacyHoursText({ open: '09:00', close: '21:15' })).toBe('09:00 - 21:15');
    expect(legacyHoursText(undefined)).toBe('');
  });

  describe('scheduleFromLegacyHoursText', () => {
    it('expands a parseable range to every weekday', () => {
      const schedule = scheduleFromLegacyHoursText('8:00 - 23:15')!;
      expect(schedule).toHaveLength(7);
      expect(schedule.every((r) => r.open === '08:00' && r.close === '23:15')).toBe(true);
    });

    it('returns undefined for free-form, out-of-range or non-string text', () => {
      expect(scheduleFromLegacyHoursText('Lun-Vie 8am - 10pm')).toBeUndefined();
      expect(scheduleFromLegacyHoursText('25:00 - 26:00')).toBeUndefined();
      expect(scheduleFromLegacyHoursText(undefined)).toBeUndefined();
      expect(scheduleFromLegacyHoursText(42)).toBeUndefined();
    });
  });

  describe('assertValidSchedule', () => {
    it('accepts an empty schedule, several ranges per day and overnight ranges', () => {
      expect(() => assertValidSchedule([])).not.toThrow();
      expect(() =>
        assertValidSchedule([
          { dayOfWeek: 1, open: '11:00', close: '14:00' },
          { dayOfWeek: 1, open: '18:00', close: '02:00' },
        ])
      ).not.toThrow();
    });

    it.each([
      ['a weekday above 6', [{ dayOfWeek: 7, open: '09:00', close: '17:00' }]],
      ['a negative weekday', [{ dayOfWeek: -1, open: '09:00', close: '17:00' }]],
      ['a non-integer weekday', [{ dayOfWeek: 1.5, open: '09:00', close: '17:00' }]],
      ['an invalid opening time', [{ dayOfWeek: 1, open: '25:00', close: '17:00' }]],
      ['a non HH:MM closing time', [{ dayOfWeek: 1, open: '09:00', close: '5pm' }]],
      ['not an array', 'monday'],
    ])('rejects %s with a ValidationError', (_label, schedule) => {
      expect(() => assertValidSchedule(schedule)).toThrow(ValidationError);
    });

    it('rejects two ranges that start at the same time on the same day', () => {
      expect(() =>
        assertValidSchedule([
          { dayOfWeek: 2, open: '09:00', close: '12:00' },
          { dayOfWeek: 2, open: '09:00', close: '15:00' },
        ])
      ).toThrow(ValidationError);
    });
  });

  describe('assertValidTimezone', () => {
    it('accepts IANA names and rejects unknown or malformed ones', () => {
      expect(() => assertValidTimezone('America/Bogota')).not.toThrow();
      expect(() => assertValidTimezone('Etc/GMT+5')).not.toThrow();
      expect(() => assertValidTimezone('Mars/Olympus')).toThrow(ValidationError);
      expect(() => assertValidTimezone('')).toThrow(ValidationError);
      expect(() => assertValidTimezone(42 as unknown as string)).toThrow(ValidationError);
    });
  });
});
