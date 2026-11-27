import { CategoryInfo } from '../constants/categories';
import { StorageData, Transaction } from '../types/finance';
import { PlusData } from '../types/plus';
import { classifyJar, computeJarStatuses, DEFAULT_JARS, JAR_META, VARIABLE_JARS } from './jars';
import { getPeriodMonthForDate, getPeriodRange } from './period';
import { getCardCycleSpending } from './creditCardStatement';
import { formatVND } from './formatters';
import { ToastTone } from './toast';
import { computeIncomeBuffer } from './incomeBuffer';

export interface SpendNotice {
  tone: ToastTone;
  title: string;
  message?: string;
}

/**
 * Đánh giá một khoản chi SẮP lưu (dựa trên dữ liệu TRƯỚC khi lưu) để đưa ra:
 * - Thông báo khoá tiền mặt khi quẹt thẻ tín dụng (Auto-Reserve).
 * - Cảnh báo 80% / vượt 100% cho hũ biến đổi (NEC, PLAY) và hạn mức tự đặt của thẻ.
 */
export function evaluateSpendNotices(params: {
  tx: Pick<Transaction, 'type' | 'cat' | 'note' | 'amount' | 'date' | 'accountId' | 'excludeFromReport'>;
  data: StorageData;
  plus: PlusData;
  categoryMap: Record<string, CategoryInfo>;
  todayStr: string;
}): SpendNotice[] {
  const { tx, data, plus, categoryMap, todayStr } = params;
  if (tx.type !== 'out' || tx.amount <= 0) return [];
  const notices: SpendNotice[] = [];

  // 1) Hũ chi tiêu biến đổi
  if (!tx.excludeFromReport) {
    const jarKey = classifyJar(tx, categoryMap);
    if (jarKey && VARIABLE_JARS.includes(jarKey)) {
      const month = getPeriodMonthForDate(tx.date, plus.periodMode, plus.payrollStartDay);
      const range = getPeriodRange(month, plus.periodMode, plus.payrollStartDay);
      const status = computeJarStatuses({
        records: data.records,
        range,
        todayStr,
        jarTargets: data.settings.jarTargets || DEFAULT_JARS,
        monthlyIncome: plus.monthlyIncome,
        categoryMap,
        cashbackToNec: plus.cashbackToNec,
      }).find(j => j.key === jarKey);

      if (status && status.budget > 0) {
        const after = status.spent + tx.amount;
        const name = `${JAR_META[jarKey].code} (${JAR_META[jarKey].label})`;
        const periodWord = plus.periodMode === 'payroll' ? 'cuối kỳ lương' : 'cuối tháng';
        if (after > status.budget) {
          notices.push({
            tone: 'danger',
            title: `Vượt hạn mức ${name} ${formatVND(after - status.budget)}!`,
            message: 'Khoản này sẽ lẹm vào tiền tiết kiệm.',
          });
        } else if (after >= status.budget * 0.8) {
          notices.push({
            tone: 'warning',
            title: `Hũ ${name} đã dùng ${Math.floor((after / status.budget) * 100)}%`,
            message: `Bạn còn ${formatVND(status.budget - after)} đến ${periodWord}.`,
          });
        }
      }
    }
  }

  // 2) Quẹt thẻ tín dụng = khoá tiền mặt + kiểm tra hạn mức tự đặt
  const card = tx.accountId ? data.cards.find(c => c.id === tx.accountId) : undefined;
  if (card) {
    const totalHeld = data.cards.reduce((s, c) => s + Math.max(0, c.currentBalance || 0), 0) + tx.amount;
    notices.push({
      tone: 'info',
      title: `Đã khoá ${formatVND(tx.amount)} tiền mặt chờ trả thẻ ${card.name}`,
      message: `Tổng đang giữ chờ trả thẻ: ${formatVND(totalHeld)}.`,
    });

    const selfLimit = plus.cardSelfLimits[card.id] || 0;
    if (selfLimit > 0) {
      const before = getCardCycleSpending(card, data.records, plus.stmtOverrides, todayStr);
      const after = before + tx.amount;
      if (after > selfLimit) {
        notices.push({
          tone: 'danger',
          title: `Vượt hạn mức tự đặt thẻ ${card.name} ${formatVND(after - selfLimit)}!`,
          message: 'Khoản này sẽ lẹm vào tiền tiết kiệm.',
        });
      } else if (after >= selfLimit * 0.8) {
        notices.push({
          tone: 'warning',
          title: `Thẻ ${card.name} đã dùng ${Math.floor((after / selfLimit) * 100)}% hạn mức tự đặt`,
          message: `Bạn còn ${formatVND(selfLimit - after)} đến kỳ sao kê sau.`,
        });
      }
    }
  }

  // 3) Chi từ ví giữ vùng đệm khi đang chờ thu nhập giữa tháng
  const buffer = computeIncomeBuffer({ data, plus, categoryMap, todayStr });
  if (buffer.active && tx.accountId && tx.accountId === buffer.accountId) {
    const afterBalance = buffer.accountBalance - tx.amount;
    if (afterBalance < buffer.required) {
      notices.push({
        tone: 'danger',
        title: `Lẹm vùng đệm ${formatVND(buffer.required - afterBalance)}!`,
        message: `${buffer.accountName} cần giữ ${formatVND(buffer.required)} đến hết ${buffer.bufferEnd.slice(8, 10)}/${buffer.bufferEnd.slice(5, 7)} phòng khi thu nhập giữa tháng về chậm.`,
      });
    }
  }

  return notices;
}
