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
  /** Đổi tên / đổi hũ / ẩn danh mục: key → chỉnh sửa */
  categoryOverrides: Record<string, CategoryOverride>;
  /** Vùng đệm an toàn chờ kỳ thu nhập giữa tháng */
  buffer: IncomeBufferSettings;
  /** Khoản cho vay / mua hộ đã thu hồi: txId khoản chi → txId khoản thu (hoặc 'manual') */
  loanSettled: Record<string, string>;
  /** Mục tiêu tiết kiệm hằng tháng (% thu nhập định mức) */
  savingsTargetPct: number;
  /** Đã áp dụng kế hoạch tài chính gia đình (tỷ lệ 6 hũ 44/42/11/3 + học phí Bun) */
  familyPlanApplied: boolean;
  /** Đã áp dụng tỷ lệ tách GIVE/LTS (44/37/11/5/3/0) */
  familyPlanV2Applied: boolean;
}

export interface IncomeBufferSettings {
  /** Ví/tài khoản giữ vùng đệm (mặc định: ví Tech / tài khoản ngân hàng đầu tiên) */
  accountId?: string;
  /** Khoản thu giữa tháng có thể về từ ngày… đến ngày… */
  midIncomeFromDay: number;
  midIncomeToDay: number;
  /** Ngày bắt đầu theo dõi vùng đệm (quanh kỳ lương cuối tháng) */
  startDay: number;
  /** Chi sinh hoạt thiết yếu mỗi ngày; 0 = tự ước tính từ lịch sử */
  dailyEssential: number;
}

export type JarChoice = 'nec' | 'ffa' | 'educ' | 'play' | 'give' | 'lts' | 'none';

/** Chỉnh sửa của người dùng lên một danh mục (có sẵn hoặc tự tạo). */
export interface CategoryOverride {
  name?: string;
  shortName?: string;
  section?: string;
  color?: string;
  iconName?: string;
  jar?: JarChoice;
  hidden?: boolean;
}

export const DEFAULT_MONTHLY_INCOME = 48_000_000;
