// Dữ liệu mở rộng "Sổ Plus" — lưu tách biệt khỏi schema gốc `sothuchi.v1`
// để không phá vỡ dữ liệu cũ và luật bảo mật Firestore hiện có.

export type PeriodMode = 'calendar' | 'payroll';

/** Loại hành động khi tick một dòng trong checklist chia lương */
export type PaydayItemKind =
  | 'transfer' // Chuyển khoản nội bộ giữa 2 ví/tài khoản
  | 'expense' // Ghi một khoản chi vào danh mục (→ hũ tương ứng)
  | 'card' // Thanh toán sao kê thẻ tín dụng
  | 'goal'; // Trích vào Quỹ mục tiêu

export interface PaydayItem {
  id: string;
  label: string;
  amount: number;
  kind: PaydayItemKind;
  fromAccountId?: string;
  toAccountId?: string; // transfer
  cat?: string; // expense
  cardId?: string; // card
  goalId?: string; // goal
}

export interface PaydayPlan {
  id: string;
  name: string; // "Kỳ 1"
  day: number; // ngày nhận lương trong tháng (30, 10…)
  items: PaydayItem[];
}

export interface PlusData {
  version: 1;
  updatedAtMs: number;
  /** Thu nhập định mức tháng dùng làm trần ngân sách 6 hũ */
  monthlyIncome: number;
  /** Bộ lọc thời gian: tháng dương lịch hay kỳ lương */
  periodMode: PeriodMode;
  /** Ngày bắt đầu kỳ lương (mặc định 30 → 30 tháng trước – 29 tháng này) */
  payrollStartDay: number;
  paydayPlans: PaydayPlan[];
  /** Key `${planId}:${itemId}:${YYYY-MM-DD ngày lương}` → id giao dịch đã sinh (hoặc 'done') */
  paydayDone: Record<string, string>;
  /** Ngân sách chi tiêu mục tiêu mỗi kỳ cho từng thẻ tín dụng */
  cardSelfLimits: Record<string, number>;
  /** Giao dịch thẻ được chuyển kỳ sao kê thủ công: txId → kỳ */
  stmtOverrides: Record<string, 'current' | 'next'>;
  /** Quỹ mục tiêu ↔ Sổ tiết kiệm liên kết: goalId → depositIds */
  goalDepositLinks: Record<string, string[]>;
  /** Giao dịch hoàn tiền/voucher được cộng trả lại hũ NEC: txId → số tiền */
  cashbackToNec: Record<string, number>;
  /** Giao dịch định kỳ tự ghi đã được người dùng đóng thông báo: txId → true */
  dismissedAutoTx: Record<string, true>;
  /** Đã tạo 2 mẫu định kỳ (Claude Pro, YouTube Premium) hay chưa */
  recurringSeeded: boolean;
}

export const DEFAULT_MONTHLY_INCOME = 48_000_000;
