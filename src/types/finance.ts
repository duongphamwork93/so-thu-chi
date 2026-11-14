export type TransactionType = 'in' | 'out';

export type BaseBeneficiaryKey = 'me' | 'spouse' | 'child1' | 'child2' | 'both_children' | 'family';

export type BeneficiaryKey = BaseBeneficiaryKey | (string & {});

export interface CustomMember {
  id: string;
  name: string;
  avatar: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  cat: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  accountId?: string;
  beneficiary?: BeneficiaryKey;
  tripName?: string;
  counterparty?: string;
  location?: string;
  excludeFromReport?: boolean;
  demo?: boolean;
  createdAt?: number;
}

export type AccountType = 'bank' | 'wallet' | 'cash' | 'invest';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  icon?: string;
  color?: string;
  accountNumber?: string;
  bankName?: string;
  note?: string;
}

export interface SavingsDeposit {
  id: string;
  bank: string;
  accountNumber?: string;
  amount: number;
  termMonths: number;
  interestRate: number; // %/year
  startDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  closed?: boolean;
  rollover?: 'all' | 'principal' | 'none';
  note?: string;
}

export type InvestmentType = 'stock' | 'fund' | 'gold' | 'silver' | 'real_estate' | 'crypto';

export interface InvestmentHolding {
  id: string;
  code: string;
  name: string;
  type: InvestmentType;
  quantity: number;
  buyPrice: number; // VNĐ per unit
  currentPrice: number; // VNĐ per unit
  note?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  bank: string;
  limit: number;
  currentBalance: number; // dư nợ hiện tại
  statementDay: number; // ngày chốt sao kê (1-31)
  dueDay: number; // ngày đến hạn thanh toán (1-31)
  color?: string;
}

export type DebtDirection = 'lend' | 'borrow'; // lend = cho vay, borrow = đi vay / nợ

export interface DebtItem {
  id: string;
  dir: DebtDirection;
  name: string; // mô tả khoản vay (ví dụ: Vay mua xe, Cho Tuấn mượn)
  targetName: string; // Tên người vay hoặc người cho vay
  amount: number; // tổng số tiền vay ban đầu
  paidAmount: number; // số tiền đã trả/thu hồi
  dueDate?: string; // YYYY-MM-DD
  interestRate?: number; // %/năm nếu có
  closed?: boolean;
  note?: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  color?: string;
  icon?: string;
}

export interface RecurringItem {
  id: string;
  type: TransactionType;
  name: string;
  amount: number;
  cat: string;
  cycle: 'monthly' | 'weekly' | 'yearly';
  dayOfMonth: number;
  accountId?: string;
  autoRecord?: boolean;
  lastRecorded?: string;
}

export interface MemberNames {
  me?: string;
  spouse?: string;
  child1?: string;
  child2?: string;
}

export interface AutoPaymentRule {
  keyword: string;
  accountId: string;
}

export interface TripEvent {
  id: string;
  name: string;
  ended?: boolean;
  budget?: number;
}

export interface JarTargets {
  nec: number;
  ffa: number;
  educ: number;
  play: number;
  give: number;
  lts: number;
}

import type { ColorThemeId } from '../constants/themes';

export type { ColorThemeId };

export interface AppSettings {
  ledgerName?: string;
  budget: number;
  goal?: string;
  risk?: string;
  privacyMask: boolean;
  theme: 'light' | 'dark' | 'system';
  colorTheme?: ColorThemeId;
  currency: string;
  merchantMap?: Record<string, string>;
  memberNames?: MemberNames;
  customMembers?: CustomMember[];
  defaultPaymentAccountId?: string;
  autoPaymentRules?: AutoPaymentRule[];
  savedTrips?: TripEvent[];
  savedContacts?: string[];
  jarTargets?: JarTargets;
}

export interface CustomCategory {
  key: string;
  name: string;
  shortName: string;
  color: string;
  type: TransactionType;
  group: 'need' | 'want' | 'save' | 'income';
  section: string;
  iconName: string;
  parentId?: string;
  createdAt?: number;
}

export interface StorageData {
  records: Transaction[];
  settings: AppSettings;
  advice: Record<string, any>;
  assets: any[];
  debts: DebtItem[];
  goals: SavingsGoal[];
  recs: RecurringItem[];
  cards: CreditCard[];
  accts: Account[];
  xfers: any[];
  deps: SavingsDeposit[];
  holds: InvestmentHolding[];
  nws: Record<string, number>;
  customCategories?: CustomCategory[];
}
