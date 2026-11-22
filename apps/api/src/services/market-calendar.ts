const marketTimeZone = "America/New_York";
const marketCloseHour = 16;

export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function isTradingDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const weekday = parsed.getUTCDay();
  return weekday !== 0 && weekday !== 6 && !marketHolidays(parsed.getUTCFullYear()).has(date);
}

export function previousTradingDate(date: string): string {
  let candidate = addCalendarDays(date, -1);
  while (!isTradingDate(candidate)) candidate = addCalendarDays(candidate, -1);
  return candidate;
}

export function latestCompletedTradingDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: marketTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = values["year"];
  const month = values["month"];
  const day = values["day"];
  const hour = values["hour"];
  if (!year || !month || !day || !hour) {
    throw new Error("Could not determine the current New York market date");
  }

  const today = `${year}-${month}-${day}`;
  if (isTradingDate(today) && Number(hour) >= marketCloseHour) {
    return today;
  }
  return previousTradingDate(today);
}

export function fetchedAfterMarketClose(fetchedAt: string, sessionDate: string): boolean {
  const fetched = new Date(fetchedAt);
  if (Number.isNaN(fetched.valueOf())) throw new Error("Invalid price fetched_at timestamp");

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: marketTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fetched);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const fetchedDate = `${values["year"]}-${values["month"]}-${values["day"]}`;
  if (fetchedDate > sessionDate) return true;
  if (fetchedDate < sessionDate) return false;
  return Number(values["hour"]) >= marketCloseHour;
}

function marketHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  for (const nominalYear of [year - 1, year, year + 1]) {
    addObservedFixedHoliday(holidays, nominalYear, 1, 1, true);
    if (nominalYear >= 2022) addObservedFixedHoliday(holidays, nominalYear, 6, 19);
    addObservedFixedHoliday(holidays, nominalYear, 7, 4);
    addObservedFixedHoliday(holidays, nominalYear, 12, 25);
  }

  holidays.add(nthWeekdayOfMonth(year, 1, 1, 3));
  holidays.add(nthWeekdayOfMonth(year, 2, 1, 3));
  holidays.add(addCalendarDays(easterSunday(year), -2));
  holidays.add(lastWeekdayOfMonth(year, 5, 1));
  holidays.add(nthWeekdayOfMonth(year, 9, 1, 1));
  holidays.add(nthWeekdayOfMonth(year, 11, 4, 4));
  return holidays;
}

function addObservedFixedHoliday(
  holidays: Set<string>,
  year: number,
  month: number,
  day: number,
  skipSaturdayObservation = false,
): void {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  if (weekday === 0) {
    holidays.add(addCalendarDays(date.toISOString().slice(0, 10), 1));
  } else if (weekday === 6) {
    if (!skipSaturdayObservation) {
      holidays.add(addCalendarDays(date.toISOString().slice(0, 10), -1));
    }
  } else {
    holidays.add(date.toISOString().slice(0, 10));
  }
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  occurrence: number,
): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysUntilWeekday = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + daysUntilWeekday + (occurrence - 1) * 7))
    .toISOString()
    .slice(0, 10);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  const daysBack = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month - 1, last.getUTCDate() - daysBack))
    .toISOString()
    .slice(0, 10);
}

function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}
