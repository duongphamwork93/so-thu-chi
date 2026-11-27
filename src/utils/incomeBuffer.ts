import { CategoryInfo, removeVietnameseAccents } from '../constants/categories';
import { StorageData } from '../types/finance';
import { PlusData } from '../types/plus';
import { classifyJar, DEFAULT_JARS } from './jars';
import { addDays, clampedDate, diffDays } from './period';
import { getCardStatementSummary } from './creditCardStatement';

/** Mã giao dịch tự ghi của khoản định kỳ (trùng quy ước trong FinanceContext). */
const recTxId = (recId: string, monthKey: string) =>
  `tx_rec_${recId}_${monthKey.replace('-', '')}`.replace(/[^a-zA-Z0-9_-]/g, '_');

// Danh mục chi cố định / lớn — không dùng để ước tính chi sinh hoạt hằng ngày
const NON_DAILY_CATS = new Set([
  'nha_o', 'dien', 'nuoc', 'internet', 'truyen_hinh', 'thue_bao', 'giao_duc', 'con_hoc_can_thiep', 'tra_no',
  'suc_khoe', 'bao_hiem_xe', 'thue_giup_viec', 'dien_thoai_dd',
]);

export interface BufferItem {
  label: string;
  amount: number;
  date: string; // YYYY-MM-DD
  kind: 'fixed' | 'card';
}

export interface IncomeBufferStatus {
  active: boolean;
  accountId?: string;
  accountName: string;
  accountBalance: number;
  /** Ngày cuối cùng cần đủ tiền (ngày muộn nhất khoản thu giữa tháng về) */
  bufferEnd: string;
  midIncomeFrom: string;
  days: number;
  fixedItems: BufferItem[];
  cardItems: BufferItem[];
  dailyEssential: number;
  dailyEssentialIsAuto: boolean;
  essentialTotal: number;
  required: number;
  shortfall: number; // > 0 = thiếu
  surplus: number; // > 0 = dư
}

/** Ước tính chi sinh hoạt thiết yếu mỗi ngày từ 60 ngày gần nhất (hũ NEC, bỏ khoản cố định/lớn). */
export function estimateDailyEssential(
  data: StorageData,
  categoryMap: Record<string, CategoryInfo>,
  todayStr: string,
  monthlyIncome: number
): number {
  const from = addDays(todayStr, -60);
  let sum = 0;
  data.records.forEach(t => {
    if (t.type !== 'out' || t.excludeFromReport || t.date < from || t.date > todayStr) return;
    if (t.id.startsWith('tx_rec_') || NON_DAILY_CATS.has(t.cat) || t.amount > 3_000_000) return;
    if (classifyJar(t, categoryMap) !== 'nec') return;
    sum += t.amount;
  });
  const est = sum / 60;
  const fallback = ((monthlyIncome * ((data.settings.jarTargets || DEFAULT_JARS).nec || 55)) / 100) * 0.35 / 30;
  const value = est > 0 ? est : fallback;
  return Math.max(10_000, Math.round(value / 10_000) * 10_000);
}

export function defaultBufferAccountId(data: StorageData): string | undefined {
  return (
    data.accts.find(a => removeVietnameseAccents(a.name).includes('tech') && a.type !== 'invest')?.id ||
    data.accts.find(a => a.type === 'bank')?.id ||
    data.accts[0]?.id
  );
}

/**
 * VÙNG ĐỆM AN TOÀN CHỜ KỲ THU NHẬP GIỮA THÁNG
 * Từ khoảng kỳ lương cuối tháng (startDay) đến ngày muộn nhất khoản thu giữa tháng về (midIncomeToDay),
 * ví giữ vùng đệm phải đủ: khoản cố định đến hạn + sao kê thẻ đến hạn + chi thiết yếu mỗi ngày × số ngày.
 */
export function computeIncomeBuffer(params: {
  data: StorageData;
  plus: PlusData;
  categoryMap: Record<string, CategoryInfo>;
  todayStr: string;
}): IncomeBufferStatus {
  const { data, plus, categoryMap, todayStr } = params;
  const cfg = plus.buffer;
  const [y, m, d] = todayStr.split('-').map(Number);

  // Đang trong giai đoạn chờ thu nhập giữa tháng?
  const inLateMonth = d >= cfg.startDay;
  const inEarlyMonth = d <= cfg.midIncomeToDay;
  const active = inLateMonth || inEarlyMonth;
  const [ey, em] = inLateMonth && !inEarlyMonth ? (m === 12 ? [y + 1, 1] : [y, m + 1]) : [y, m];
  const bufferEnd = clampedDate(ey, em, cfg.midIncomeToDay);
  const midIncomeFrom = clampedDate(ey, em, cfg.midIncomeFromDay);
  const days = Math.max(0, diffDays(todayStr, bufferEnd));

  const accountId = cfg.accountId && data.accts.some(a => a.id === cfg.accountId) ? cfg.accountId : defaultBufferAccountId(data);
  const acct = data.accts.find(a => a.id === accountId);

  // 1) Khoản cố định (định kỳ đang bật) đến hạn trong (hôm nay, bufferEnd]
  const fixedItems: BufferItem[] = [];
  const existing = new Set(data.records.map(r => r.id));
  data.recs
    .filter(r => r.type === 'out' && r.autoRecord !== false && r.amount > 0)
    .forEach(r => {
      for (let i = 0; i < 2; i++) {
        const [yy, mm] = m + i > 12 ? [y + 1, m + i - 12] : [y, m + i];
        const monthKey = `${yy}-${String(mm).padStart(2, '0')}`;
        const due = clampedDate(yy, mm, r.dayOfMonth);
        if (due < todayStr || due > bufferEnd) continue;
        if (existing.has(recTxId(r.id, monthKey))) continue; // đã trừ tiền rồi
        fixedItems.push({ label: r.name, amount: r.amount, date: due, kind: 'fixed' });
      }
    });

  // 2) Sao kê thẻ chưa trả, đến hạn trước bufferEnd (chỉ khi trả từ ví thanh toán)
  const cardItems: BufferItem[] = [];
  data.cards.forEach(c => {
    const st = getCardStatementSummary(c, data.records, todayStr, plus.stmtOverrides);
    if (st.remainingDue > 0 && st.dueDate <= bufferEnd) {
      cardItems.push({ label: `Sao kê ${c.name}`, amount: st.remainingDue, date: st.dueDate, kind: 'card' });
    }
  });

  // 3) Chi sinh hoạt thiết yếu đến hết bufferEnd
  const dailyEssentialIsAuto = !(cfg.dailyEssential > 0);
  const dailyEssential = dailyEssentialIsAuto
    ? estimateDailyEssential(data, categoryMap, todayStr, plus.monthlyIncome)
    : cfg.dailyEssential;
  const essentialTotal = dailyEssential * days;

  const required =
    fixedItems.reduce((s, i) => s + i.amount, 0) + cardItems.reduce((s, i) => s + i.amount, 0) + essentialTotal;
  const balance = acct?.balance || 0;

  return {
    active,
    accountId,
    accountName: acct?.name || 'Ví thanh toán',
    accountBalance: balance,
    bufferEnd,
    midIncomeFrom,
    days,
    fixedItems: fixedItems.sort((a, b) => a.date.localeCompare(b.date)),
    cardItems: cardItems.sort((a, b) => a.date.localeCompare(b.date)),
    dailyEssential,
    dailyEssentialIsAuto,
    essentialTotal,
    required,
    shortfall: Math.max(0, required - balance),
    surplus: Math.max(0, balance - required),
  };
}
