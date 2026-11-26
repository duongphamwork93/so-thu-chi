import { Account, CreditCard, DebtItem, InvestmentHolding, SavingsDeposit, StorageData } from '../types/finance';

const numberFormatter = new Intl.NumberFormat('vi-VN');

export function formatVND(amount: number): string {
  const rounded = Math.round(amount || 0);
  return `${numberFormatter.format(rounded)} ₫`;
}

export function formatVNDShort(amount: number): string {
  const abs = Math.abs(amount || 0);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} tỷ`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace('.', ',')} tr`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}k`;
  }
  return `${sign}${Math.round(abs)}`;
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthString(): string {
  return getTodayDateString().slice(0, 7);
}

export function shiftMonthString(monthStr: string, offsetMonths: number): string {
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthNumStr);
  const date = new Date(year, month - 1 + offsetMonths, 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
}

const WEEKDAYS = [
  'Chủ nhật',
  'Thứ hai',
  'Thứ ba',
  'Thứ tư',
  'Thứ năm',
  'Thứ sáu',
  'Thứ bảy',
];

export function formatDateVietnamese(dateStr: string): string {
  if (!dateStr) return '';
  const today = getTodayDateString();
  if (dateStr === today) return 'Hôm nay';

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yYear = yesterdayDate.getFullYear();
  const yMonth = String(yesterdayDate.getMonth() + 1).padStart(2, '0');
  const yDay = String(yesterdayDate.getDate()).padStart(2, '0');
  const yesterday = `${yYear}-${yMonth}-${yDay}`;
  if (dateStr === yesterday) return 'Hôm qua';

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const weekday = WEEKDAYS[d.getDay()] || '';
    return `${weekday}, ${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function formatDayMonthOnly(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

// Parse conversational text like "65k", "1tr2", "1.5tr", "250.000", "500000"
export function parseVietnameseMoneyText(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.trim().toLowerCase().replace(/,/g, '.');

  // e.g. "1tr5" -> 1.5tr -> 1,500,000
  const trMatches = cleaned.match(/^(\d+(?:\.\d+)?)\s*tr(?:iệu)?(?:\s*(\d+))?$/);
  if (trMatches) {
    const main = parseFloat(trMatches[1]) * 1_000_000;
    const sub = trMatches[2] ? parseFloat(trMatches[2]) * 100_000 : 0;
    return Math.round(main + sub);
  }

  // e.g. "2.5 tỷ"
  const tyMatches = cleaned.match(/^(\d+(?:\.\d+)?)\s*tỷ$/);
  if (tyMatches) {
    return Math.round(parseFloat(tyMatches[1]) * 1_000_000_000);
  }

  // e.g. "65k", "250k"
  const kMatches = cleaned.match(/^(\d+(?:\.\d+)?)\s*k$/);
  if (kMatches) {
    return Math.round(parseFloat(kMatches[1]) * 1_000);
  }

  // Pure digits or dot-separated like 100.000
  const plainDigits = cleaned.replace(/\D/g, '');
  const parsed = parseInt(plainDigits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Calculate savings deposit accrued interest
export function calculateDepositAccrued(deposit: SavingsDeposit): { accrued: number; maturityInterest: number; daysLeft: number } {
  if (deposit.closed) return { accrued: 0, maturityInterest: 0, daysLeft: 0 };
  const start = new Date(deposit.startDate).getTime();
  const maturity = new Date(deposit.maturityDate).getTime();
  const now = new Date().getTime();

  const totalDays = Math.max(1, Math.round((maturity - start) / (1000 * 60 * 60 * 24)));
  const daysPassed = Math.min(totalDays, Math.max(0, Math.round((now - start) / (1000 * 60 * 60 * 24))));
  const daysLeft = Math.max(0, Math.round((maturity - now) / (1000 * 60 * 60 * 24)));

  // Simple interest: Principal * (Rate / 100) * (days / 365)
  const rateYear = (deposit.interestRate || 0) / 100;
  const accrued = Math.round(deposit.amount * rateYear * (daysPassed / 365));
  const maturityInterest = Math.round(deposit.amount * rateYear * (totalDays / 365));

  return { accrued, maturityInterest, daysLeft };
}

// Calculate investment holding current value & gain/loss
export function calculateHoldingValue(holding: InvestmentHolding): { value: number; cost: number; pnl: number; pnlPercent: number } {
  const cost = holding.quantity * holding.buyPrice;
  const value = holding.quantity * (holding.currentPrice || holding.buyPrice);
  const pnl = value - cost;
  const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
  return { value, cost, pnl, pnlPercent };
}

// Calculate overall Net Worth
export function calculateNetWorthBreakdown(data: StorageData) {
  // 1. Bank Accounts & Wallets & Cash
  const accountsTotal = data.accts.reduce((sum, a) => sum + (a.balance || 0), 0);

  // 2. Savings Deposits (Principal + Accrued Interest)
  const depositsTotal = data.deps
    .filter(d => !d.closed)
    .reduce((sum, d) => {
      const { accrued } = calculateDepositAccrued(d);
      return sum + d.amount + accrued;
    }, 0);

  // 3. Investments (Stocks, Funds, Gold, Real Estate)
  const investmentsTotal = data.holds.reduce((sum, h) => {
    const { value } = calculateHoldingValue(h);
    return sum + value;
  }, 0);

  // 4. Other Assets
  const otherAssetsTotal = (data.assets || []).reduce((sum, a) => sum + (a.value || 0), 0);

  const totalGrossAssets = accountsTotal + depositsTotal + investmentsTotal + otherAssetsTotal;

  // 5. Receivables (Money lent to others - Cho vay)
  const receivables = data.debts
    .filter(d => d.dir === 'lend' && !d.closed)
    .reduce((sum, d) => sum + Math.max(0, (d.amount || 0) - (d.paidAmount || 0)), 0);

  // 6. Liabilities (Money borrowed from others - Đi vay / nợ)
  const payables = data.debts
    .filter(d => d.dir === 'borrow' && !d.closed)
    .reduce((sum, d) => sum + Math.max(0, (d.amount || 0) - (d.paidAmount || 0)), 0);

  // 7. Credit Card Outstanding balance (Dư nợ thẻ tín dụng)
  const creditCardsDebt = data.cards.reduce((sum, c) => sum + (c.currentBalance || 0), 0);

  const totalLiabilities = payables + creditCardsDebt;

  // Net Worth = Gross Assets + Receivables - Liabilities
  const netWorth = totalGrossAssets + receivables - totalLiabilities;

  return {
    accountsTotal,
    depositsTotal,
    investmentsTotal,
    otherAssetsTotal,
    totalGrossAssets,
    receivables,
    payables,
    creditCardsDebt,
    totalLiabilities,
    netWorth,
  };
}
