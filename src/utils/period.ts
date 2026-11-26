import { PeriodMode } from '../types/plus';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function ymd(y: number, m1: number, d: number): string {
  return `${y}-${pad2(m1)}-${pad2(d)}`;
}

function daysInMonth(y: number, m1: number): number {
  return new Date(y, m1, 0).getDate();
}

/** Ngày `day` của tháng (y, m1), tự co về ngày cuối tháng nếu tháng ngắn hơn. */
export function clampedDate(y: number, m1: number, day: number): string {
  return ymd(y, m1, Math.min(Math.max(1, day), daysInMonth(y, m1)));
}

function shiftYM(y: number, m1: number, offset: number): [number, number] {
  const idx = y * 12 + (m1 - 1) + offset;
  return [Math.floor(idx / 12), (idx % 12) + 1];
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

export interface PeriodRange {
  start: string; // YYYY-MM-DD (bao gồm)
  end: string; // YYYY-MM-DD (bao gồm)
  totalDays: number;
  label: string; // "Tháng 11/2026" | "Kỳ lương T11/2026"
  rangeLabel: string; // "01/11 – 30/11"
}

const short = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

/**
 * Khoảng thời gian ứng với tháng `month` (YYYY-MM).
 * - calendar: ngày 1 → ngày cuối tháng.
 * - payroll: ngày `startDay` tháng trước → ngày trước `startDay` tháng này.
 */
export function getPeriodRange(month: string, mode: PeriodMode, startDay = 30): PeriodRange {
  const [y, m] = month.split('-').map(Number);
  if (mode === 'calendar' || startDay <= 1) {
    const start = ymd(y, m, 1);
    const end = ymd(y, m, daysInMonth(y, m));
    return {
      start,
      end,
      totalDays: diffDays(start, end) + 1,
      label: `Tháng ${m}/${y}`,
      rangeLabel: `${short(start)} – ${short(end)}`,
    };
  }
  const [py, pm] = shiftYM(y, m, -1);
  const start = clampedDate(py, pm, startDay);
  const nextStart = clampedDate(y, m, startDay);
  const end = addDays(nextStart, -1);
  return {
    start,
    end,
    totalDays: diffDays(start, end) + 1,
    label: `Kỳ lương T${m}/${y}`,
    rangeLabel: `${short(start)} – ${short(end)}`,
  };
}

/** Kỳ (theo `mode`) đang chứa ngày `dateStr` → trả về khóa tháng YYYY-MM. */
export function getPeriodMonthForDate(dateStr: string, mode: PeriodMode, startDay = 30): string {
  const month = dateStr.slice(0, 7);
  if (mode === 'calendar') return month;
  const range = getPeriodRange(month, mode, startDay);
  if (dateStr > range.end) {
    const [y, m] = month.split('-').map(Number);
    const [ny, nm] = shiftYM(y, m, 1);
    return `${ny}-${pad2(nm)}`;
  }
  return month;
}

/** Số ngày đã trôi qua trong kỳ (tính cả hôm nay), giới hạn trong [0, totalDays]. */
export function elapsedDaysInPeriod(range: PeriodRange, todayStr: string): number {
  if (todayStr < range.start) return 0;
  if (todayStr > range.end) return range.totalDays;
  return diffDays(range.start, todayStr) + 1;
}

/** Ngày nhận lương gần nhất (≤ hôm nay) cho một ngày lương cố định trong tháng. */
export function latestPaydayDate(day: number, todayStr: string): string {
  const [y, m] = todayStr.split('-').map(Number);
  const thisMonth = clampedDate(y, m, day);
  if (thisMonth <= todayStr) return thisMonth;
  const [py, pm] = shiftYM(y, m, -1);
  return clampedDate(py, pm, day);
}

/** Ngày nhận lương kế tiếp (> hôm nay). */
export function nextPaydayDate(day: number, todayStr: string): string {
  const [y, m] = todayStr.split('-').map(Number);
  const thisMonth = clampedDate(y, m, day);
  if (thisMonth > todayStr) return thisMonth;
  const [ny, nm] = shiftYM(y, m, 1);
  return clampedDate(ny, nm, day);
}

/** Đếm số ngày lương (theo danh sách ngày trong tháng) trong khoảng (from, to]. */
export function countPaydaysBetween(days: number[], fromStr: string, toStr: string): number {
  if (toStr <= fromStr || days.length === 0) return 0;
  let count = 0;
  let [y, m] = fromStr.split('-').map(Number);
  for (let guard = 0; guard < 600; guard++) {
    for (const d of days) {
      const ds = clampedDate(y, m, d);
      if (ds > fromStr && ds <= toStr) count++;
    }
    if (ymd(y, m, 1) > toStr) break;
    [y, m] = shiftYM(y, m, 1);
  }
  return count;
}
