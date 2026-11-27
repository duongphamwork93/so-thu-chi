import { CategoryInfo, removeVietnameseAccents } from '../constants/categories';
import { JarTargets, StorageData, Transaction } from '../types/finance';
import { PlusData } from '../types/plus';
import { classifyJar, computeJarStatuses, DEFAULT_JARS, JAR_META, JarStatus } from './jars';
import { PeriodRange, addDays, diffDays } from './period';
import { getCardStatementSummary } from './creditCardStatement';
import { calculateDepositAccrued } from './formatters';
import { computeIncomeBuffer, IncomeBufferStatus } from './incomeBuffer';

/**
 * Ảnh chụp số liệu cứng cho "Kiểm toán Tài chính Cá nhân".
 * Tính hoàn toàn trên máy → hiển thị được ngay cả khi AI lỗi, và làm payload gửi AI.
 */
export interface AuditSnapshot {
  period: { label: string; start: string; end: string; today: string; elapsedPct: number; daysLeft: number };
  monthlyIncome: number;
  jarTargets: JarTargets;
  liquidity: {
    cashAccounts: Array<{ name: string; type: string; balance: number }>;
    cashTotal: number;
    cardDebtTotal: number;
    realSpendable: number;
    dueSoonTotal: number; // sao kê thẻ phải trả trong 35 ngày tới
    level: 'safe' | 'warning' | 'danger';
  };
  cards: Array<{
    name: string;
    currentBalance: number;
    statementDue: number;
    dueDate: string;
    daysUntilDue: number;
    selfLimit: number;
  }>;
  jars: JarStatus[];
  worstJar?: JarStatus;
  savings: {
    deposits: Array<{ bank: string; amount: number; maturityDate: string }>;
    goals: Array<{ title: string; current: number; target: number; targetDate?: string }>;
  };
  pendingLoans: Array<{ title: string; amount: number; date: string; daysAgo: number; source: 'tx' | 'debt' }>;
  leaks: Array<{ label: string; count: number; total: number; avg: number }>;
  buffer: IncomeBufferStatus;
  totals: { income: number; expense: number; neutral: number };
  transactions: Array<{
    date: string;
    name: string;
    category: string;
    jar: string;
    type: 'Thu' | 'Chi';
    amount: number;
    source: string;
  }>;
}

const LEAK_PLATFORMS = [
  'shopee', 'lazada', 'tiktok', 'tiki', 'grab', 'xanh sm', 'be ', 'highlands', 'phuc long', 'starbucks', 'katinat',
  'circle k', 'gs25', '7-eleven', 'winmart', 'bach hoa xanh', 'long chau', 'pharmacity', 'baemin', 'shopeefood',
];

export function buildAuditSnapshot(params: {
  data: StorageData;
  plus: PlusData;
  categoryMap: Record<string, CategoryInfo>;
  range: PeriodRange;
  todayStr: string;
}): AuditSnapshot {
  const { data, plus, categoryMap, range, todayStr } = params;
  const jarTargets = data.settings.jarTargets || DEFAULT_JARS;
  const inPeriod = (t: Transaction) => t.date >= range.start && t.date <= range.end;
  const sourceName = (id?: string) =>
    data.accts.find(a => a.id === id)?.name || data.cards.find(c => c.id === id)?.name || '';

  // 1) Thanh khoản
  const cashAccounts = data.accts
    .filter(a => a.type !== 'invest')
    .map(a => ({ name: a.name, type: a.type, balance: a.balance }));
  const cashTotal = cashAccounts.reduce((s, a) => s + a.balance, 0);
  const cards = data.cards.map(c => {
    const st = getCardStatementSummary(c, data.records, todayStr, plus.stmtOverrides);
    return {
      name: c.name,
      currentBalance: c.currentBalance,
      statementDue: st.remainingDue,
      dueDate: st.dueDate,
      daysUntilDue: st.daysUntilDue,
      selfLimit: plus.cardSelfLimits[c.id] || 0,
    };
  });
  const cardDebtTotal = cards.reduce((s, c) => s + Math.max(0, c.currentBalance), 0);
  const dueSoonTotal = cards.filter(c => c.daysUntilDue <= 35).reduce((s, c) => s + c.statementDue, 0);
  const realSpendable = cashTotal - cardDebtTotal;
  const level: AuditSnapshot['liquidity']['level'] =
    cashTotal < dueSoonTotal || realSpendable < 0 ? 'danger' : realSpendable < plus.monthlyIncome * 0.1 ? 'warning' : 'safe';

  // 2) 6 hũ theo ngân sách định mức
  const jars = computeJarStatuses({
    records: data.records,
    range,
    todayStr,
    jarTargets,
    monthlyIncome: plus.monthlyIncome,
    categoryMap,
    cashbackToNec: plus.cashbackToNec,
  });
  const worstJar = [...jars]
    .filter(j => j.spent > 0)
    .sort((a, b) => a.remaining - b.remaining || b.usedPct - a.usedPct)[0];

  // 3) Tổng thu/chi kỳ (tách Trung tính)
  const periodTx = data.records.filter(inPeriod);
  let income = 0;
  let expense = 0;
  let neutral = 0;
  periodTx.forEach(t => {
    if (t.excludeFromReport) return;
    if (t.type === 'in') income += t.amount;
    else if (classifyJar(t, categoryMap) === null) neutral += t.amount;
    else expense += t.amount;
  });

  // 4) Khoản treo: cho vay / mua hộ chưa thấy thu nợ
  const since = addDays(todayStr, -120);
  const repayments = data.records.filter(t => t.type === 'in' && (t.cat === 'thu_no' || t.cat === 'thu_khac'));
  const norm = (s?: string) => removeVietnameseAccents(s || '').trim();
  const pendingLoans: AuditSnapshot['pendingLoans'] = data.records
    .filter(t => t.type === 'out' && t.cat === 'cho_vay' && t.date >= since)
    .filter(t => {
      const who = norm(t.counterparty);
      return !repayments.some(
        r =>
          r.date >= t.date &&
          ((who && (norm(r.counterparty) === who || norm(r.note).includes(who))) || Math.abs(r.amount - t.amount) < 1000)
      );
    })
    .map(t => ({
      title: [t.note, t.counterparty].filter(Boolean).join(' · ') || 'Cho vay / Mua hộ',
      amount: t.amount,
      date: t.date,
      daysAgo: diffDays(t.date, todayStr),
      source: 'tx' as const,
    }));
  data.debts
    .filter(d => d.dir === 'lend' && !d.closed && d.amount - (d.paidAmount || 0) > 0)
    .forEach(d =>
      pendingLoans.push({
        title: `${d.name} · ${d.targetName}`,
        amount: d.amount - (d.paidAmount || 0),
        date: d.dueDate || '',
        daysAgo: 0,
        source: 'debt',
      })
    );

  // 5) Rò rỉ: giao dịch nhỏ tần suất cao
  const groups = new Map<string, { label: string; count: number; total: number }>();
  periodTx
    .filter(t => t.type === 'out' && !t.excludeFromReport && t.amount <= 500_000 && classifyJar(t, categoryMap) !== null)
    .forEach(t => {
      const text = ' ' + norm(`${t.counterparty || ''} ${t.note || ''}`) + ' ';
      const platform = LEAK_PLATFORMS.find(p => text.includes(p));
      const label = platform
        ? platform.trim().replace(/\b\w/g, c => c.toUpperCase())
        : categoryMap[t.cat]?.name || t.cat;
      const g = groups.get(label) || { label, count: 0, total: 0 };
      g.count += 1;
      g.total += t.amount;
      groups.set(label, g);
    });
  const leaks = [...groups.values()]
    .filter(g => g.count >= 3)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map(g => ({ ...g, avg: Math.round(g.total / g.count) }));

  // 6) Tiết kiệm & quỹ
  const deposits = data.deps
    .filter(d => !d.closed)
    .map(d => ({ bank: d.bank, amount: d.amount + calculateDepositAccrued(d).accrued, maturityDate: d.maturityDate }));
  const goals = data.goals.map(g => {
    const linked = (plus.goalDepositLinks[g.id] || []).reduce((s, id) => {
      const d = data.deps.find(x => x.id === id && !x.closed);
      return s + (d ? d.amount + calculateDepositAccrued(d).accrued : 0);
    }, 0);
    return { title: g.title, current: g.currentAmount + linked, target: g.targetAmount, targetDate: g.targetDate };
  });

  // 7) Danh sách giao dịch kỳ (gọn cho AI)
  const transactions = periodTx
    .filter(t => !t.excludeFromReport)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-300)
    .map(t => {
      const jar = t.type === 'in' ? '' : classifyJar(t, categoryMap);
      return {
        date: t.date,
        name: (t.note || categoryMap[t.cat]?.name || '').slice(0, 80),
        category: categoryMap[t.cat]?.name || t.cat,
        jar: t.type === 'in' ? 'Thu' : jar ? JAR_META[jar].code : 'Trung tính',
        type: (t.type === 'in' ? 'Thu' : 'Chi') as 'Thu' | 'Chi',
        amount: t.amount,
        source: sourceName(t.accountId),
      };
    });

  const elapsed = Math.max(0, Math.min(range.totalDays, diffDays(range.start, todayStr) + 1));
  return {
    period: {
      label: range.label,
      start: range.start,
      end: range.end,
      today: todayStr,
      elapsedPct: Math.round((elapsed / range.totalDays) * 100),
      daysLeft: Math.max(0, diffDays(todayStr, range.end)),
    },
    monthlyIncome: plus.monthlyIncome,
    jarTargets,
    liquidity: { cashAccounts, cashTotal, cardDebtTotal, realSpendable, dueSoonTotal, level },
    cards,
    jars,
    worstJar,
    savings: { deposits, goals },
    pendingLoans,
    leaks,
    buffer: computeIncomeBuffer({ data, plus, categoryMap, todayStr }),
    totals: { income, expense, neutral },
    transactions,
  };
}
