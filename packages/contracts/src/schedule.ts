import { z } from 'zod';

// ==========================================
// WEEKLY OPENING SCHEDULE
// ==========================================
// A schedule is a flat list of ranges. A weekday with no range is closed and
// a weekday may hold several ranges (e.g. lunch and dinner). `dayOfWeek` is
// 0-6 with 0 = Sunday. Times are "HH:MM" wall-clock times in the restaurant's
// IANA timezone. `close <= open` means the range ends on the NEXT day, so a
// Monday 20:00-02:00 range keeps the restaurant open until Tuesday 02:00.

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeOfDay(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function isValidTimeZone(value: string): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const openingRangeSchema = z.object({
  dayOfWeek: z.number().int().min(0, 'Day of week must be between 0 and 6').max(6, 'Day of week must be between 0 and 6'),
  open: z.string().refine(isValidTimeOfDay, 'Opening time must be HH:MM'),
  close: z.string().refine(isValidTimeOfDay, 'Closing time must be HH:MM'),
});
export type OpeningRange = z.infer<typeof openingRangeSchema>;

export const weeklyScheduleSchema = z.array(openingRangeSchema);
export type WeeklySchedule = OpeningRange[];

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const MINUTES_PER_DAY = 24 * 60;

const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

// Weekday (0 = Sunday) and minutes since midnight of `now` in `timeZone`.
function localClock(now: Date, timeZone: string): { dayOfWeek: number; minutes: number } {
  const parts = getFormatter(timeZone).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    dayOfWeek: WEEKDAYS[get('weekday')] ?? 0,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * True when `now`, read in the restaurant's `timeZone`, falls inside any range.
 * The close time is exclusive. Throws RangeError on an invalid timezone.
 */
export function isOpenAt(schedule: WeeklySchedule, now: Date, timeZone: string): boolean {
  const { dayOfWeek, minutes } = localClock(now, timeZone);
  const previousDay = (dayOfWeek + 6) % 7;

  return schedule.some((range) => {
    const open = toMinutes(range.open);
    const close = toMinutes(range.close);
    const overnight = close <= open;

    if (range.dayOfWeek === dayOfWeek) {
      return overnight ? minutes >= open : minutes >= open && minutes < close;
    }
    // The tail of yesterday's overnight range.
    return overnight && range.dayOfWeek === previousDay && minutes < close;
  });
}

export interface NextOpening {
  dayOfWeek: number;
  time: string;
  /** 0 = later today, 1 = tomorrow ... 7 = the same weekday next week. */
  daysAhead: number;
}

/**
 * The next range start strictly after `now` (in `timeZone`), or null when the
 * schedule has no ranges. Overnight tails are not openings.
 */
export function nextOpening(schedule: WeeklySchedule, now: Date, timeZone: string): NextOpening | null {
  const { dayOfWeek, minutes } = localClock(now, timeZone);
  let best: { key: number; value: NextOpening } | null = null;

  for (const range of schedule) {
    const open = toMinutes(range.open);
    let daysAhead = (range.dayOfWeek - dayOfWeek + 7) % 7;
    if (daysAhead === 0 && open <= minutes) daysAhead = 7;

    const key = daysAhead * MINUTES_PER_DAY + open;
    if (!best || key < best.key) {
      best = { key, value: { dayOfWeek: range.dayOfWeek, time: range.open, daysAhead } };
    }
  }

  return best ? best.value : null;
}

/** Weekday (0 = Sunday) of `now` in the restaurant's `timeZone`. */
export function localDayOfWeek(now: Date, timeZone: string): number {
  return localClock(now, timeZone).dayOfWeek;
}

// Fragments of the 400 messages the backend returns when a public order is
// rejected because the restaurant is closed or has paused its orders. The
// messages are built from (and the frontend matches on) these constants so the
// two sides cannot drift.
export const ORDER_CLOSED_ERROR_FRAGMENT = 'fuera del horario de atención';
export const ORDER_PAUSED_ERROR_FRAGMENT = 'pedidos en pausa';
