import { isValidTimeOfDay, isValidTimeZone, localDayOfWeek, weeklyScheduleSchema } from '@burger-page/contracts';
import type { WeeklySchedule } from '@burger-page/contracts';
import { ValidationError } from '../errors/DomainErrors.js';
import type { OpeningHours } from '../models/Restaurant.js';

/**
 * Helpers around the weekly opening schedule (restaurant_opening_hours is the
 * single stored source). The legacy `openingHours` {open, close} object and the
 * config.openingHours "HH:MM - HH:MM" text are read-only projections derived
 * from it so older API consumers keep working.
 */

export const DEFAULT_TIMEZONE = 'America/Bogota';
const DEFAULT_OPEN = '12:00';
const DEFAULT_CLOSE = '22:30';

const LEGACY_TEXT_PATTERN = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/;

/** The same range on all 7 weekdays. */
export function everyDaySchedule(open: string, close: string): WeeklySchedule {
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open, close }));
}

/** The schedule every new restaurant starts with: 12:00-22:30, all 7 days. */
export function defaultWeeklySchedule(): WeeklySchedule {
  return everyDaySchedule(DEFAULT_OPEN, DEFAULT_CLOSE);
}

/** Open around the clock (00:00-00:00 spans a full day): demo and test data. */
export function alwaysOpenSchedule(): WeeklySchedule {
  return everyDaySchedule('00:00', '00:00');
}

export function sortSchedule(schedule: WeeklySchedule): WeeklySchedule {
  return [...schedule].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.open.localeCompare(b.open));
}

/**
 * Legacy single-range view: today's first range in the restaurant timezone,
 * else the first range of the week; undefined when the schedule is empty.
 */
export function legacyOpeningHours(
  schedule: WeeklySchedule,
  timeZone: string,
  now: Date = new Date()
): OpeningHours | undefined {
  if (schedule.length === 0) return undefined;
  const sorted = sortSchedule(schedule);
  const today = localDayOfWeek(now, timeZone);
  const range = sorted.find((r) => r.dayOfWeek === today) ?? sorted[0];
  return { open: range.open, close: range.close };
}

export function legacyHoursText(hours: OpeningHours | undefined): string {
  return hours ? `${hours.open} - ${hours.close}` : '';
}

/**
 * Parses the legacy "HH:MM - HH:MM" hours text an older admin client may still
 * send and expands it to every weekday. Anything else (free-form text, invalid
 * times, non-strings) yields undefined: it is not stored anywhere.
 */
export function scheduleFromLegacyHoursText(text: unknown): WeeklySchedule | undefined {
  if (typeof text !== 'string') return undefined;
  const match = LEGACY_TEXT_PATTERN.exec(text);
  if (!match) return undefined;
  const open = `${match[1].padStart(2, '0')}:${match[2]}`;
  const close = `${match[3].padStart(2, '0')}:${match[4]}`;
  if (!isValidTimeOfDay(open) || !isValidTimeOfDay(close)) return undefined;
  return everyDaySchedule(open, close);
}

/**
 * Validates a schedule received from a client: shape, weekday 0-6, HH:MM
 * times, and no two ranges starting at the same time on the same weekday
 * (the table keeps one row per (restaurant, weekday, start)).
 */
export function assertValidSchedule(schedule: unknown): asserts schedule is WeeklySchedule {
  const parsed = weeklyScheduleSchema.safeParse(schedule);
  if (!parsed.success) {
    throw new ValidationError(`Invalid opening schedule: ${parsed.error.issues[0]?.message ?? 'malformed ranges'}`);
  }
  const seen = new Set<string>();
  for (const range of parsed.data) {
    const key = `${range.dayOfWeek}@${range.open}`;
    if (seen.has(key)) {
      throw new ValidationError(`Invalid opening schedule: duplicated range starting at ${range.open} on day ${range.dayOfWeek}`);
    }
    seen.add(key);
  }
}

/** The timezone must be a name the runtime's tz database (Intl) understands. */
export function assertValidTimezone(timezone: unknown): asserts timezone is string {
  if (typeof timezone !== 'string' || !isValidTimeZone(timezone)) {
    throw new ValidationError('Timezone must be a valid IANA timezone (e.g. America/Bogota)');
  }
}
