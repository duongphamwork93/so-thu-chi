import { CreditCard, Transaction } from '../types/finance';
import { getTodayDateString } from './formatters';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(year, month1Based, 0).getDate();
}

function clampDay(year: number, month1Based: number, day: number): number {
  const safeDay = Math.max(1, Math.min(31, Math.round(day || 1)));
  return Math.min(safeDay, daysInMonth(year, month1Based));
}

function parseYMD(dateStr: string): [number, number, number] {
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    return [parts[0], parts[1], parts[2]];
  }
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()];
}

function formatYMD(year: number, month1Based: number, day: number): string {
  return `${year}-${pad2(month1Based)}-${pad2(day)}`;
}

/**
 * Returns the most recent statement closing date (YYYY-MM-DD) that is <= todayStr.
 */
export function getLatestStatementDate(statementDay: number, todayStr?: string): string {
  const today = todayStr || getTodayDateString();
  const [y, m, d] = parseYMD(today);
  const thisMonthCloseDay = clampDay(y, m, statementDay);

  if (d >= thisMonthCloseDay) {
    return formatYMD(y, m, thisMonthCloseDay);
  }

  // Previous month
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const prevCloseDay = clampDay(prevY, prevM, statementDay);
  return formatYMD(prevY, prevM, prevCloseDay);
}

/**
 * Returns the next upcoming statement closing date (YYYY-MM-DD) strictly after latestStatementDate.
 */
export function getNextStatementDate(statementDay: number, latestStatementDate: string): string {
  const [y, m] = parseYMD(latestStatementDate);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return formatYMD(nextY, nextM, clampDay(nextY, nextM, statementDay));
}

/**
 * Computes the payment due date (YYYY-MM-DD) corresponding to a given statement closing date.
 * If dueDay > statementDay, payment is due in the same calendar month; otherwise in the next month.
 */
export function getStatementDueDate(statementDateStr: string, dueDay: number): string {
  const [y, m, stmtD] = parseYMD(statementDateStr);
  const safeDue = Math.max(1, Math.min(31, Math.round(dueDay || 5)));

  if (safeDue > stmtD) {
    return formatYMD(y, m, clampDay(y, m, safeDue));
  }
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return formatYMD(nextY, nextM, clampDay(nextY, nextM, safeDue));
}

/**
 * Estimates the exact card balance at the end of latestStatementDate by backing out
 * transactions recorded strictly after latestStatementDate up to todayStr.
 */
export function computeStatementSnapshot(
  card: CreditCard,
  records: Transaction[],
  latestStatementDate: string,
  todayStr?: string
): number {
  const today = todayStr || getTodayDateString();
  let postStatementNet = 0;

  for (const r of records) {
    if (r.accountId !== card.id || !r.date) continue;
    if (r.date > latestStatementDate && r.date <= today) {
      postStatementNet += r.type === 'out' ? r.amount : -r.amount;
    }
  }

  return Math.max(0, Math.round((card.currentBalance || 0) - postStatementNet));
}

export function formatShortDayMonth(dateStr: string): string {
  const [, m, d] = parseYMD(dateStr);
  return `${pad2(d)}/${pad2(m)}`;
}

export function diffCalendarDays(fromDateStr: string, toDateStr: string): number {
  const [fy, fm, fd] = parseYMD(fromDateStr);
  const [ty, tm, td] = parseYMD(toDateStr);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

export interface CreditCardStatementSummary {
  latestStatementDate: string;
  nextStatementDate: string;
  statementMonthLabel: string; // e.g., "T11/2026"
  statementDateShort: string; // e.g., "20/11"
  dueDate: string;
  dueDateShort: string; // e.g., "05/12"
  daysUntilDue: number;
  hasRecordedStatement: boolean;
  statementBalance: number;
  paidAmount: number;
  remainingDue: number;
  isPaidInFull: boolean;
  postStatementSpending: number;
  recommendedPaymentAmount: number;
}

export function getCardStatementSummary(
  card: CreditCard,
  records: Transaction[],
  todayStr?: string
): CreditCardStatementSummary {
  const today = todayStr || getTodayDateString();
  const latestStatementDate = getLatestStatementDate(card.statementDay, today);
  const nextStatementDate = getNextStatementDate(card.statementDay, latestStatementDate);
  const dueDate = getStatementDueDate(latestStatementDate, card.dueDay);
  const daysUntilDue = diffCalendarDays(today, dueDate);

  const [stmtY, stmtM] = parseYMD(latestStatementDate);
  const statementMonthLabel = `T${stmtM}/${stmtY}`;

  const isCurrentCycleRecorded =
    card.lastStatementDate === latestStatementDate && card.statementBalance !== undefined;

  const statementBalance = isCurrentCycleRecorded
    ? Math.max(0, Number(card.statementBalance) || 0)
    : computeStatementSnapshot(card, records, latestStatementDate, today);

  const paidAmount = isCurrentCycleRecorded
    ? Math.max(0, Number(card.statementPaidAmount) || 0)
    : 0;

  const unpaidRaw = Math.max(0, statementBalance - paidAmount);
  // Remaining due cannot exceed current total debt on the card
  const remainingDue = Math.min(unpaidRaw, Math.max(0, card.currentBalance || 0));
  const isPaidInFull = statementBalance > 0 && remainingDue === 0;
  const postStatementSpending = Math.max(0, (card.currentBalance || 0) - remainingDue);
  const recommendedPaymentAmount =
    remainingDue > 0 ? remainingDue : Math.max(0, card.currentBalance || 0);

  return {
    latestStatementDate,
    nextStatementDate,
    statementMonthLabel,
    statementDateShort: formatShortDayMonth(latestStatementDate),
    dueDate,
    dueDateShort: formatShortDayMonth(dueDate),
    daysUntilDue,
    hasRecordedStatement: isCurrentCycleRecorded,
    statementBalance,
    paidAmount,
    remainingDue,
    isPaidInFull,
    postStatementSpending,
    recommendedPaymentAmount,
  };
}
