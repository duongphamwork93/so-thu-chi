import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Account,
  AppSettings,
  CreditCard,
  CustomCategory,
  DebtItem,
  InvestmentHolding,
  RecurringItem,
  SavingsDeposit,
  SavingsGoal,
  StorageData,
  Transaction,
} from '../types/finance';
import { ColorThemeId, VALID_COLOR_THEME_IDS } from '../constants/themes';

function trunc(val: string | undefined | null, maxLen: number): string {
  if (!val) return '';
  return String(val).slice(0, maxLen);
}

function safeNum(val: any, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function sanitizeId(id: string): string {
  const clean = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return (clean || 'id_' + Date.now().toString(36)).slice(0, 128);
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const res: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      res[k] = v;
    }
  }
  return res as T;
}

export function timestampToMillis(val: any): number | undefined {
  if (typeof val === 'number') return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  return undefined;
}

// 1. User Profile
export async function ensureUserProfileDoc(user: User): Promise<void> {
  const uid = sanitizeId(user.uid);
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  const profileFields = stripUndefined({
    email: trunc(user.email || 'user@example.com', 200),
    displayName: trunc(user.displayName || user.email?.split('@')[0] || 'Người dùng', 120),
    photoURL: user.photoURL ? trunc(user.photoURL, 500) : undefined,
    updatedAt: serverTimestamp(),
  });

  if (!snap.exists()) {
    try {
      await setDoc(ref, {
        uid,
        ...profileFields,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, profileFields);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }
}

// 2. Settings
export function toFirestoreSettings(settings: AppSettings, ownerId: string, isCreate: boolean) {
  const theme =
    settings.theme === 'dark' || settings.theme === 'system' ? settings.theme : 'light';
  const cleanRules =
    settings.autoPaymentRules !== undefined
      ? (settings.autoPaymentRules || [])
          .filter(r => r && typeof r.keyword === 'string' && r.keyword.trim().length > 0 && r.accountId)
          .slice(0, 30)
          .map(r => ({
            keyword: trunc(r.keyword.trim(), 80),
            accountId: sanitizeId(r.accountId),
          }))
      : undefined;

  const cleanCustomMembers =
    settings.customMembers !== undefined
      ? (settings.customMembers || [])
          .filter(m => m && typeof m.id === 'string' && typeof m.name === 'string' && m.name.trim().length > 0)
          .slice(0, 20)
          .map(m => ({
            id: sanitizeId(m.id),
            name: trunc(m.name.trim(), 40),
            avatar: trunc(m.avatar?.trim() || '👤', 16) || '👤',
          }))
      : undefined;

  const cleanSavedTrips =
    settings.savedTrips !== undefined
      ? (settings.savedTrips || [])
          .filter(t => t && typeof t.id === 'string' && typeof t.name === 'string' && t.name.trim().length > 0)
          .slice(0, 30)
          .map(t =>
            stripUndefined({
              id: sanitizeId(t.id),
              name: trunc(t.name.trim(), 80),
              ended: t.ended !== undefined ? Boolean(t.ended) : undefined,
              budget: typeof t.budget === 'number' && Number.isFinite(t.budget) ? Math.max(0, t.budget) : undefined,
            })
          )
      : undefined;

  const cleanSavedContacts =
    settings.savedContacts !== undefined
      ? (settings.savedContacts || [])
          .filter(c => typeof c === 'string' && c.trim().length > 0)
          .slice(0, 40)
          .map(c => trunc(c.trim(), 80))
      : undefined;

  const cleanJarTargets =
    settings.jarTargets !== undefined && settings.jarTargets
      ? {
          nec: safeNum(settings.jarTargets.nec, 55),
          ffa: safeNum(settings.jarTargets.ffa, 10),
          educ: safeNum(settings.jarTargets.educ, 10),
          play: safeNum(settings.jarTargets.play, 10),
          give: safeNum(settings.jarTargets.give, 5),
          lts: safeNum(settings.jarTargets.lts, 10),
        }
      : undefined;

  const payload = stripUndefined({
    ownerId: sanitizeId(ownerId),
    ledgerName: settings.ledgerName !== undefined ? trunc(settings.ledgerName, 60) : undefined,
    budget: Number(settings.budget) || 0,
    goal: settings.goal !== undefined ? trunc(settings.goal, 200) : undefined,
    risk: settings.risk !== undefined ? trunc(settings.risk, 50) : undefined,
    privacyMask: Boolean(settings.privacyMask),
    theme,
    colorTheme:
      settings.colorTheme && VALID_COLOR_THEME_IDS.includes(settings.colorTheme)
        ? settings.colorTheme
        : 'emerald',
    currency: trunc(settings.currency || 'VND', 10) || 'VND',
    meName: settings.memberNames?.me !== undefined ? trunc(settings.memberNames.me, 50) : undefined,
    spouseName:
      settings.memberNames?.spouse !== undefined ? trunc(settings.memberNames.spouse, 50) : undefined,
    child1Name:
      settings.memberNames?.child1 !== undefined ? trunc(settings.memberNames.child1, 50) : undefined,
    child2Name:
      settings.memberNames?.child2 !== undefined ? trunc(settings.memberNames.child2, 50) : undefined,
    defaultPaymentAccountId:
      settings.defaultPaymentAccountId !== undefined
        ? settings.defaultPaymentAccountId
          ? sanitizeId(settings.defaultPaymentAccountId)
          : ''
        : undefined,
    autoPaymentRules: cleanRules,
    customMembers: cleanCustomMembers,
    savedTrips: cleanSavedTrips,
    savedContacts: cleanSavedContacts,
    jarTargets: cleanJarTargets,
    updatedAt: serverTimestamp(),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
  });
  return payload;
}

export function fromFirestoreSettings(data: Record<string, any>): AppSettings {
  return {
    ledgerName: data.ledgerName || 'Sổ Thu Chi',
    budget: typeof data.budget === 'number' ? data.budget : 20000000,
    goal: data.goal || 'Tiết kiệm 30% thu nhập',
    risk: data.risk || 'trung bình',
    privacyMask: Boolean(data.privacyMask),
    theme: data.theme || 'light',
    colorTheme: VALID_COLOR_THEME_IDS.includes(data.colorTheme as ColorThemeId)
      ? (data.colorTheme as ColorThemeId)
      : 'emerald',
    currency: data.currency || 'VND',
    memberNames: {
      me: data.meName || undefined,
      spouse: data.spouseName || undefined,
      child1: data.child1Name || undefined,
      child2: data.child2Name || undefined,
    },
    defaultPaymentAccountId: data.defaultPaymentAccountId || undefined,
    autoPaymentRules: Array.isArray(data.autoPaymentRules)
      ? data.autoPaymentRules.filter(
          (r: any) => r && typeof r.keyword === 'string' && typeof r.accountId === 'string'
        )
      : undefined,
    customMembers: Array.isArray(data.customMembers)
      ? data.customMembers
          .filter((m: any) => m && typeof m.id === 'string' && typeof m.name === 'string')
          .map((m: any) => ({
            id: m.id,
            name: m.name,
            avatar: typeof m.avatar === 'string' && m.avatar ? m.avatar : '👤',
          }))
      : undefined,
    savedTrips: Array.isArray(data.savedTrips)
      ? data.savedTrips
          .filter((t: any) => t && typeof t.id === 'string' && typeof t.name === 'string')
          .map((t: any) => ({
            id: t.id,
            name: t.name,
            ended: Boolean(t.ended),
            budget: typeof t.budget === 'number' ? t.budget : undefined,
          }))
      : undefined,
    savedContacts: Array.isArray(data.savedContacts)
      ? data.savedContacts.filter((c: any) => typeof c === 'string' && c.trim().length > 0)
      : undefined,
    jarTargets:
      data.jarTargets && typeof data.jarTargets === 'object'
        ? {
            nec: Number(data.jarTargets.nec ?? 55),
            ffa: Number(data.jarTargets.ffa ?? 10),
            educ: Number(data.jarTargets.educ ?? 10),
            play: Number(data.jarTargets.play ?? 10),
            give: Number(data.jarTargets.give ?? 5),
            lts: Number(data.jarTargets.lts ?? 10),
          }
        : undefined,
  };
}

// 3. Transaction
export function toFirestoreTransaction(tx: Transaction, ownerId: string, isCreate: boolean) {
  const id = sanitizeId(tx.id);
  const beneficiary = tx.beneficiary ? sanitizeId(String(tx.beneficiary).trim()) : undefined;

  return stripUndefined({
    id,
    ownerId: sanitizeId(ownerId),
    type: tx.type === 'in' ? 'in' : 'out',
    cat: trunc(tx.cat || 'khac', 80) || 'khac',
    amount: Math.max(0, safeNum(tx.amount, 0)),
    date: trunc(tx.date ? String(tx.date).trim() : '', 20) || new Date().toISOString().slice(0, 10),
    note: tx.note !== undefined ? trunc(tx.note, 500) : undefined,
    accountId: tx.accountId ? trunc(tx.accountId, 128) : undefined,
    beneficiary,
    tripName: tx.tripName !== undefined && tx.tripName.trim() ? trunc(tx.tripName.trim(), 80) : undefined,
    counterparty:
      tx.counterparty !== undefined && tx.counterparty.trim()
        ? trunc(tx.counterparty.trim(), 80)
        : undefined,
    location: tx.location !== undefined && tx.location.trim() ? trunc(tx.location.trim(), 120) : undefined,
    excludeFromReport: tx.excludeFromReport !== undefined ? Boolean(tx.excludeFromReport) : undefined,
    clientCreatedAt: isCreate
      ? typeof tx.createdAt === 'number' && Number.isFinite(tx.createdAt)
        ? tx.createdAt
        : Date.now()
      : undefined,
    updatedAt: serverTimestamp(),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
  });
}

export function fromFirestoreTransaction(data: Record<string, any>): Transaction {
  return {
    id: data.id,
    type: data.type === 'in' ? 'in' : 'out',
    cat: data.cat || 'khac',
    amount: Number(data.amount) || 0,
    date: data.date || '',
    note: data.note || undefined,
    accountId: data.accountId || undefined,
    beneficiary: data.beneficiary || undefined,
    tripName: data.tripName || undefined,
    counterparty: data.counterparty || undefined,
    location: data.location || undefined,
    excludeFromReport: data.excludeFromReport ? true : undefined,
    createdAt: data.clientCreatedAt || timestampToMillis(data.createdAt) || Date.now(),
  };
}

// 4. Account
export function toFirestoreAccount(acc: Account, ownerId: string, isCreate: boolean) {
  const id = sanitizeId(acc.id);
  const validTypes = new Set(['bank', 'wallet', 'cash', 'invest']);
  return stripUndefined({
    id,
    ownerId: sanitizeId(ownerId),
    name: trunc(acc.name || 'Tài khoản', 100) || 'Tài khoản',
    type: validTypes.has(acc.type) ? acc.type : 'bank',
    balance: Number(acc.balance) || 0,
    icon: acc.icon !== undefined ? trunc(acc.icon, 50) : undefined,
    color: acc.color !== undefined ? trunc(acc.color, 30) : undefined,
    accountNumber: acc.accountNumber !== undefined ? trunc(acc.accountNumber, 50) : undefined,
    bankName: acc.bankName !== undefined ? trunc(acc.bankName, 100) : undefined,
    note: acc.note !== undefined ? trunc(acc.note, 300) : undefined,
    updatedAt: serverTimestamp(),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
  });
}

export function fromFirestoreAccount(data: Record<string, any>): Account {
  return {
    id: data.id,
    name: data.name || 'Tài khoản',
    type: data.type || 'bank',
    balance: Number(data.balance) || 0,
    icon: data.icon || undefined,
    color: data.color || undefined,
    accountNumber: data.accountNumber || undefined,
    bankName: data.bankName || undefined,
    note: data.note || undefined,
  };
}

// 5. Credit Card
export function toFirestoreCard(card: CreditCard, ownerId: string, isCreate: boolean) {
  const id = sanitizeId(card.id);
  return stripUndefined({
    id,
    ownerId: sanitizeId(ownerId),
    name: trunc(card.name || 'Thẻ tín dụng', 100) || 'Thẻ tín dụng',
    bank: trunc(card.bank || '', 100),
    limit: Math.max(0, Number(card.limit) || 0),
    currentBalance: Math.max(0, Number(card.currentBalance) || 0),
    statementDay: Number(card.statementDay) || 20,
    dueDay: Number(card.dueDay) || 5,
    color: card.color !== undefined ? trunc(card.color, 30) : undefined,
    updatedAt: serverTimestamp(),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
  });
}

export function fromFirestoreCard(data: Record<string, any>): CreditCard {
  return {
    id: data.id,
    name: data.name || 'Thẻ tín dụng',
    bank: data.bank || '',
    limit: Number(data.limit) || 0,
    currentBalance: Number(data.currentBalance) || 0,
    statementDay: Number(data.statementDay) || 20,
    dueDay: Number(data.dueDay) || 5,
    color: data.color || undefined,
  };
}

// 6. Savings Deposit
export function toFirestoreDeposit(dep: SavingsDeposit, ownerId: string, isCreate: boolean) {
  const id = sanitizeId(dep.id);
  const validRollover = new Set(['all', 'principal', 'none']);
  return stripUndefined({
    id,
    ownerId: sanitizeId(ownerId),
    bank: trunc(dep.bank || 'Ngân hàng', 100) || 'Ngân hàng',
    accountNumber: dep.accountNumber !== undefined ? trunc(dep.accountNumber, 50) : undefined,
    amount: Math.max(0, safeNum(dep.amount, 0)),
    termMonths: Math.max(0, safeNum(dep.termMonths, 0)),
    interestRate: Math.max(0, safeNum(dep.interestRate, 0)),
    startDate: trunc(dep.startDate ? String(dep.startDate).trim() : '', 20) || new Date().toISOString().slice(0, 10),
    maturityDate: trunc(dep.maturityDate ? String(dep.maturityDate).trim() : '', 20) || new Date().toISOString().slice(0, 10),
    closed: dep.closed !== undefined ? Boolean(dep.closed) : undefined,
    rollover: dep.rollover && validRollover.has(dep.rollover) ? dep.rollover : undefined,
    note: dep.note !== undefined ? trunc(dep.note, 300) : undefined,
    updatedAt: serverTimestamp(),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
  });
}

export function fromFirestoreDeposit(data: Record<string, any>): SavingsDeposit {
  return {
    id: data.id,
    bank: data.bank || '',
    accountNumber: data.accountNumber || undefined,
    amount: Number(data.amount) || 0,
    termMonths: Number(data.termMonths) || 0,
    interestRate: Number(data.interestRate) || 0,
    startDate: data.startDate || '',
    maturityDate: data.maturityDate || '',
    closed: Boolean(data.closed),
    rollover: data.rollover || undefined,
    note: data.note || undefined,
  };
}

// 7. Investment Holding
export function toFirestoreHolding(h: InvestmentHolding, ownerId: string, isCreate: boolean) {
  const id = sanitizeId(h.id);
  const validTypes = new Set(['stock', 'fund', 'gold', 'silver', 'real_estate', 'crypto']);
  return stripUndefined({
    id,
    ownerId: sanitizeId(ownerId),
    code: trunc(h.code || 'ASSET', 40) || 'ASSET',
    name: trunc(h.name || h.code || 'Tài sản', 120) || 'Tài sản',
    type: validTypes.has(h.type) ? h.type : 'stock',
    quantity: Math.max(0, Number(h.quantity) || 0),
    buyPrice: Math.max(0, Number(h.buyPrice) || 0),
    currentPrice: Math.max(0, Number(h.currentPrice) || 0),
    note: h.note !== undefined ? trunc(h.note, 300) : undefined,
    updatedAt: serverTimestamp(),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
  });
}

export function fromFirestoreHolding(data: Record<string, any>): InvestmentHolding {
  return {
    id: data.id,
    code: data.code || '',
    name: data.name || '',
    type: data.type || 'stock',
    quantity: Number(data.quantity) || 0,
    buyPrice: Number(data.buyPrice) || 0,
    currentPrice: Number(data.currentPrice) || 0,
    note: data.note || undefined,
  };
}

// 8. Debt Item
export function toFirestoreDebt(debt: DebtItem, ownerId: string, isCreate: boolean) {
  const id = sanitizeId(debt.id);
  return stripUndefined({
    id,
    ownerId: sanitizeId(ownerId),
    dir: debt.dir === 'lend' ? 'lend' : 'borrow',
    name: trunc(debt.name || 'Khoản vay', 150) || 'Khoản vay',
    targetName: trunc(debt.targetName || 'Đối tác', 100) || 'Đối tác',
    amount: Math.max(0, Number(debt.amount) || 0),
    paidAmount: Math.max(0, Number(debt.paidAmount) || 0),
    dueDate: debt.dueDate !== undefined ? trunc(debt.dueDate, 20) : undefined,
    interestRate: debt.interestRate !== undefined ? Number(debt.interestRate) || 0 : undefined,
    closed: debt.closed !== undefined ? Boolean(debt.closed) : undefined,
    note: debt.note !== undefined ? trunc(debt.note, 300) : undefined,
    updatedAt: serverTimestamp(),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
  });
}

export function fromFirestoreDebt(data: Record<string, any>): DebtItem {
  return {
    id: data.id,
    dir: data.dir === 'lend' ? 'lend' : 'borrow',
    name: data.name || '',
    targetName: data.targetName || '',
    amount: Number(data.amount) || 0,
    paidAmount: Number(data.paidAmount) || 0,
    dueDate: data.dueDate || undefined,
    interestRate: data.interestRate !== undefined ? Number(data.interestRate) : undefined,
    closed: Boolean(data.closed),
    note: data.note || undefined,
  };
}

// 9. Savings Goal
export function toFirestoreGoal(goal: SavingsGoal, ownerId: string, isCreate: boolean) {
  const id = sanitizeId(goal.id);
  return stripUndefined({
    id,
    ownerId: sanitizeId(ownerId),
    title: trunc(goal.title || 'Mục tiêu', 150) || 'Mục tiêu',
    targetAmount: Math.max(0, Number(goal.targetAmount) || 0),
    currentAmount: Math.max(0, Number(goal.currentAmount) || 0),
    targetDate: goal.targetDate !== undefined ? trunc(goal.targetDate, 20) : undefined,
    color: goal.color !== undefined ? trunc(goal.color, 30) : undefined,
    icon: goal.icon !== undefined ? trunc(goal.icon, 50) : undefined,
    updatedAt: serverTimestamp(),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
  });
}

export function fromFirestoreGoal(data: Record<string, any>): SavingsGoal {
  return {
    id: data.id,
    title: data.title || '',
    targetAmount: Number(data.targetAmount) || 0,
    currentAmount: Number(data.currentAmount) || 0,
    targetDate: data.targetDate || undefined,
    color: data.color || undefined,
    icon: data.icon || undefined,
  };
}

// 10. Recurring Item
export function toFirestoreRecurring(rec: RecurringItem, ownerId: string, isCreate: boolean) {
  const id = sanitizeId(rec.id);
  const validCycles = new Set(['monthly', 'weekly', 'yearly']);
  return stripUndefined({
    id,
    ownerId: sanitizeId(ownerId),
    type: rec.type === 'in' ? 'in' : 'out',
    name: trunc(rec.name || 'Định kỳ', 150) || 'Định kỳ',
    amount: Math.max(0, Number(rec.amount) || 0),
    cat: trunc(rec.cat || 'khac', 80) || 'khac',
    cycle: validCycles.has(rec.cycle) ? rec.cycle : 'monthly',
    dayOfMonth: Number(rec.dayOfMonth) || 1,
    accountId: rec.accountId ? trunc(rec.accountId, 128) : undefined,
    autoRecord: rec.autoRecord !== undefined ? Boolean(rec.autoRecord) : undefined,
    lastRecorded: rec.lastRecorded !== undefined ? trunc(rec.lastRecorded, 20) : undefined,
    updatedAt: serverTimestamp(),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
  });
}

export function fromFirestoreRecurring(data: Record<string, any>): RecurringItem {
  return {
    id: data.id,
    type: data.type === 'in' ? 'in' : 'out',
    name: data.name || '',
    amount: Number(data.amount) || 0,
    cat: data.cat || 'khac',
    cycle: data.cycle || 'monthly',
    dayOfMonth: Number(data.dayOfMonth) || 1,
    accountId: data.accountId || undefined,
    autoRecord: data.autoRecord,
    lastRecorded: data.lastRecorded || undefined,
  };
}

// 11. Transfer
export function toFirestoreTransfer(xfer: any, ownerId: string, isCreate: boolean) {
  const id = sanitizeId(xfer.id);
  return stripUndefined({
    id,
    ownerId: sanitizeId(ownerId),
    fromId: trunc(xfer.fromId || '', 128) || 'acc',
    toId: trunc(xfer.toId || '', 128) || 'acc',
    amount: Math.max(1, Number(xfer.amount) || 1),
    note: xfer.note !== undefined ? trunc(xfer.note, 300) : undefined,
    date: trunc(xfer.date || new Date().toISOString().slice(0, 10), 20),
    updatedAt: serverTimestamp(),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
  });
}

export function fromFirestoreTransfer(data: Record<string, any>) {
  return {
    id: data.id,
    fromId: data.fromId,
    toId: data.toId,
    amount: Number(data.amount) || 0,
    note: data.note || undefined,
    date: data.date || '',
  };
}

// 12. Custom Category
export function toFirestoreCustomCategory(cat: CustomCategory, ownerId: string, isCreate: boolean) {
  const key = sanitizeId(cat.key);
  const validGroups = new Set(['need', 'want', 'save', 'income']);
  return stripUndefined({
    key,
    ownerId: sanitizeId(ownerId),
    name: trunc(cat.name || 'Danh mục', 80) || 'Danh mục',
    shortName: trunc(cat.shortName || cat.name || 'Danh mục', 40) || 'Danh mục',
    color: trunc(cat.color || '#10B981', 30) || '#10B981',
    type: cat.type === 'in' ? 'in' : 'out',
    group: validGroups.has(cat.group) ? cat.group : cat.type === 'in' ? 'income' : 'need',
    section: trunc(cat.section || 'Tự tạo', 60) || 'Tự tạo',
    iconName: trunc(cat.iconName || 'Tag', 50) || 'Tag',
    parentId: cat.parentId !== undefined ? trunc(cat.parentId, 128) : undefined,
    clientCreatedAt: isCreate
      ? typeof cat.createdAt === 'number'
        ? cat.createdAt
        : Date.now()
      : undefined,
    updatedAt: serverTimestamp(),
    ...(isCreate ? { createdAt: serverTimestamp() } : {}),
  });
}

export function fromFirestoreCustomCategory(data: Record<string, any>): CustomCategory {
  return {
    key: data.key,
    name: data.name || '',
    shortName: data.shortName || data.name || '',
    color: data.color || '#10B981',
    type: data.type === 'in' ? 'in' : 'out',
    group: data.group || 'need',
    section: data.section || 'Tự tạo',
    iconName: data.iconName || 'Tag',
    parentId: data.parentId || undefined,
    createdAt: data.clientCreatedAt || timestampToMillis(data.createdAt) || Date.now(),
  };
}

// Batch Upload full local StorageData to Firestore (chunked <= 400 writes per batch)
export async function uploadLocalLedgerToCloud(
  userId: string,
  localData: StorageData,
  options: { mergeOnly?: boolean; existingIds?: Set<string> } = {}
): Promise<void> {
  const uid = sanitizeId(userId);
  const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any>; isUpdate?: boolean }> = [];

  // Track which documents already exist in Firestore (and whether deposits/debts are closed)
  const existingMap = new Map<string, { closed?: boolean }>();

  if (options.mergeOnly && options.existingIds) {
    options.existingIds.forEach(k => existingMap.set(k, {}));
  } else {
    const settingsRef = doc(db, 'users', uid, 'settings', 'main');
    const settingsSnap = await getDoc(settingsRef).catch(err =>
      handleFirestoreError(err, OperationType.GET, `users/${uid}/settings/main`)
    );
    ops.push({
      ref: settingsRef,
      data: toFirestoreSettings(localData.settings, uid, !settingsSnap.exists()),
      isUpdate: settingsSnap.exists(),
    });

    if (settingsSnap.exists()) {
      const subCols = [
        'accounts',
        'cards',
        'deposits',
        'holdings',
        'debts',
        'goals',
        'recurrings',
        'transfers',
        'customCategories',
        'transactions',
      ];
      await Promise.all(
        subCols.map(async colName => {
          const q = query(collection(db, 'users', uid, colName), where('ownerId', '==', uid));
          const snap = await getDocs(q).catch(err =>
            handleFirestoreError(err, OperationType.LIST, `users/${uid}/${colName}`)
          );
          snap.forEach(d => {
            existingMap.set(`${colName}:${d.id}`, { closed: Boolean(d.data()?.closed) });
          });
        })
      );
    }
  }

  const pushCollection = <T>(
    colName: string,
    items: T[] | undefined,
    getId: (item: T) => string,
    mapper: (item: T, ownerId: string, isCreate: boolean) => Record<string, any>
  ) => {
    for (const item of items || []) {
      const id = sanitizeId(getId(item));
      const key = `${colName}:${id}`;
      const existing = existingMap.get(key);
      if (existing) {
        // In mergeOnly mode, or for immutable transfers, or for closed deposits/debts, skip overwriting
        if (
          options.mergeOnly ||
          colName === 'transfers' ||
          ((colName === 'deposits' || colName === 'debts') && existing.closed)
        ) {
          continue;
        }
        ops.push({
          ref: doc(db, 'users', uid, colName, id),
          data: mapper(item, uid, false),
          isUpdate: true,
        });
      } else {
        ops.push({
          ref: doc(db, 'users', uid, colName, id),
          data: mapper(item, uid, true),
        });
      }
    }
  };

  pushCollection('accounts', localData.accts, a => a.id, toFirestoreAccount);
  pushCollection('cards', localData.cards, c => c.id, toFirestoreCard);
  pushCollection('deposits', localData.deps, d => d.id, toFirestoreDeposit);
  pushCollection('holdings', localData.holds, h => h.id, toFirestoreHolding);
  pushCollection('debts', localData.debts, d => d.id, toFirestoreDebt);
  pushCollection('goals', localData.goals, g => g.id, toFirestoreGoal);
  pushCollection('recurrings', localData.recs, r => r.id, toFirestoreRecurring);
  pushCollection('transfers', localData.xfers, x => x.id, toFirestoreTransfer);
  pushCollection('customCategories', localData.customCategories, c => c.key, toFirestoreCustomCategory);
  pushCollection('transactions', localData.records, r => r.id, toFirestoreTransaction);

  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.isUpdate) {
        batch.update(op.ref, op.data);
      } else {
        batch.set(op.ref, op.data);
      }
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    }
  }
}
