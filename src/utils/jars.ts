import { CategoryInfo, canonicalCategoryKey } from '../constants/categories';
import { JarTargets, Transaction } from '../types/finance';
import { PeriodRange, elapsedDaysInPeriod } from './period';

export type JarKey = keyof JarTargets;

export const DEFAULT_JARS: JarTargets = {
  nec: 44,
  lts: 37,
  educ: 11,
  give: 5,
  play: 3,
  ffa: 0,
};

export const JAR_META: Record<JarKey, { code: string; label: string; desc: string; color: string }> = {
  nec: { code: 'NEC', label: 'Thiết yếu', desc: 'Ăn uống, nhà cửa, điện nước, đi lại, y tế', color: '#059669' },
  ffa: { code: 'FFA', label: 'Tự do tài chính', desc: 'Mua vàng tích trữ, đầu tư, chứng chỉ quỹ', color: '#0D9488' },
  educ: { code: 'EDUC', label: 'Giáo dục', desc: 'Học phí, sách vở, khóa học', color: '#0891B2' },
  play: { code: 'PLAY', label: 'Hưởng thụ', desc: 'Cà phê, giải trí, du lịch, mua sắm', color: '#F59E0B' },
  give: { code: 'GIVE', label: 'Cho đi', desc: 'Quà tặng, thăm hỏi, hiếu hỉ', color: '#EC4899' },
  lts: { code: 'LTS', label: 'Tiết kiệm dài hạn', desc: 'Quỹ Tết, quỹ dự phòng, tích luỹ mua nhà/xe', color: '#4F46E5' },
};

export const JAR_ORDER: JarKey[] = ['nec', 'play', 'educ', 'give', 'ffa', 'lts'];

/** Hũ chi tiêu biến đổi: áp dụng cảnh báo vượt chi & chỉ báo tốc độ. */
export const VARIABLE_JARS: JarKey[] = ['nec', 'play'];

/**
 * Phân loại một khoản chi vào hũ. Trả về null nếu là giao dịch trung tính
 * (VD: Cho vay / Tạm ứng) — không tính vào 6 hũ.
 */
export function classifyJar(
  tx: Pick<Transaction, 'cat' | 'note'>,
  categoryMap: Record<string, CategoryInfo>
): JarKey | null {
  const cat = categoryMap[tx.cat] || categoryMap[canonicalCategoryKey(tx.cat)];
  // 1) Hũ gắn cố định theo hạng mục
  if (cat?.jar) return cat.jar === 'none' ? null : cat.jar;

  const catNameLower = (cat?.name || '').toLowerCase();
  const noteLower = (tx.note || '').toLowerCase();

  if (
    tx.cat === 'giao_duc' ||
    tx.cat === 'hoc_hanh' ||
    tx.cat === 'con_sach_vo' ||
    catNameLower.includes('học') ||
    catNameLower.includes('sách')
  ) {
    return 'educ';
  }
  if (
    tx.cat === 'hieu_hi' ||
    tx.cat === 'cuoi_xin' ||
    tx.cat === 'tham_hoi' ||
    tx.cat === 'ma_chay' ||
    catNameLower.includes('tặng') ||
    catNameLower.includes('từ thiện')
  ) {
    return 'give';
  }
  if (
    noteLower.includes('đầu tư') ||
    noteLower.includes('chứng khoán') ||
    catNameLower.includes('đầu tư')
  ) {
    return 'ffa';
  }
  if (tx.cat === 'tiet_kiem' || cat?.group === 'save') return 'lts';
  if (cat?.group === 'need') return 'nec';
  return 'play';
}

export interface JarStatus {
  key: JarKey;
  code: string;
  label: string;
  color: string;
  targetPct: number;
  budget: number; // trần ngân sách = thu nhập định mức × %
  spent: number;
  remaining: number; // còn được tiêu (có thể âm)
  usedPct: number; // % đã dùng so với trần
  elapsedPct: number; // % số ngày đã trôi qua trong kỳ
  isVariable: boolean;
  isFast: boolean; // tiêu nhanh hơn thời gian ≥ 20 điểm %
  txCount: number;
}

export function isTxInRange(tx: Pick<Transaction, 'date'>, range: Pick<PeriodRange, 'start' | 'end'>): boolean {
  return Boolean(tx.date) && tx.date >= range.start && tx.date <= range.end;
}

export function computeJarStatuses(params: {
  records: Transaction[];
  range: PeriodRange;
  todayStr: string;
  jarTargets: JarTargets;
  monthlyIncome: number;
  categoryMap: Record<string, CategoryInfo>;
  cashbackToNec?: Record<string, number>;
}): JarStatus[] {
  const { records, range, todayStr, jarTargets, monthlyIncome, categoryMap, cashbackToNec } = params;
  const spent: Record<JarKey, number> = { nec: 0, ffa: 0, educ: 0, play: 0, give: 0, lts: 0 };
  const counts: Record<JarKey, number> = { nec: 0, ffa: 0, educ: 0, play: 0, give: 0, lts: 0 };

  for (const tx of records) {
    if (!isTxInRange(tx, range)) continue;
    if (tx.type === 'out' && !tx.excludeFromReport) {
      const jar = classifyJar(tx, categoryMap);
      if (!jar) continue;
      spent[jar] += tx.amount;
      counts[jar] += 1;
    } else if (tx.type === 'in' && cashbackToNec && cashbackToNec[tx.id]) {
      // Hoàn tiền / voucher trả lại hũ NEC (không tính là thu nhập mới)
      spent.nec -= cashbackToNec[tx.id];
    }
  }

  const elapsedPct = Math.round((elapsedDaysInPeriod(range, todayStr) / Math.max(1, range.totalDays)) * 100);

  return JAR_ORDER.map(key => {
    const meta = JAR_META[key];
    const targetPct = jarTargets[key] ?? DEFAULT_JARS[key];
    const budget = Math.round((monthlyIncome * targetPct) / 100);
    const s = Math.max(0, spent[key]);
    const usedPct = budget > 0 ? Math.round((s / budget) * 100) : s > 0 ? 100 : 0;
    const isVariable = VARIABLE_JARS.includes(key);
    return {
      key,
      code: meta.code,
      label: meta.label,
      color: meta.color,
      targetPct,
      budget,
      spent: s,
      remaining: budget - s,
      usedPct,
      elapsedPct,
      isVariable,
      isFast: isVariable && usedPct - elapsedPct >= 20 && usedPct < 100,
      txCount: counts[key],
    };
  });
}
