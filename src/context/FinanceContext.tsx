import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
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
import { formatVND, getCurrentMonthString, getTodayDateString, shiftMonthString } from '../utils/formatters';
import {
  CategoryInfo,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  CATEGORY_MAP,
} from '../constants/categories';
import { getColorThemeOption } from '../constants/themes';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import {
  ensureUserProfileDoc,
  fromFirestoreAccount,
  fromFirestoreCard,
  fromFirestoreCustomCategory,
  fromFirestoreDebt,
  fromFirestoreDeposit,
  fromFirestoreGoal,
  fromFirestoreHolding,
  fromFirestoreRecurring,
  fromFirestoreSettings,
  fromFirestoreTransaction,
  fromFirestoreTransfer,
  sanitizeId,
  toFirestoreAccount,
  toFirestoreCard,
  toFirestoreCustomCategory,
  toFirestoreDebt,
  toFirestoreDeposit,
  toFirestoreGoal,
  toFirestoreHolding,
  toFirestoreRecurring,
  toFirestoreSettings,
  toFirestoreTransaction,
  toFirestoreTransfer,
  uploadLocalLedgerToCloud,
} from '../utils/firestoreSync';

const STORAGE_KEY = 'sothuchi.v1';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export function getInitialDemoData(): StorageData {
  const defaultAccounts: Account[] = [
    { id: 'acc_cash', name: 'Tiền mặt trong ví', type: 'cash', balance: 0, color: '#10B981' },
    { id: 'acc_bank', name: 'Tài khoản ngân hàng chính', type: 'bank', balance: 0, bankName: 'Ngân hàng', color: '#2563EB' },
  ];

  const defaultSettings: AppSettings = {
    ledgerName: 'Sổ Thu Chi',
    budget: 20000000,
    goal: 'Tiết kiệm 30% thu nhập',
    risk: 'trung bình',
    privacyMask: false,
    theme: 'light',
    colorTheme: 'emerald',
    currency: 'VND',
  };

  return {
    records: [],
    settings: defaultSettings,
    advice: {},
    assets: [],
    debts: [],
    goals: [],
    recs: [],
    cards: [],
    accts: defaultAccounts,
    xfers: [],
    deps: [],
    holds: [],
    nws: {},
    customCategories: [],
  };
}

function loadLocalData(): StorageData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        const cleanedRecords = Array.isArray(parsed.records)
          ? parsed.records.filter((r: any) => !r.id || !/^tx_\d+$/.test(r.id))
          : [];
        const cleanedHolds = Array.isArray(parsed.holds)
          ? parsed.holds.filter((h: any) => !h.id || !/^inv_\d+$/.test(h.id))
          : [];
        const cleanedDeps = Array.isArray(parsed.deps)
          ? parsed.deps.filter((d: any) => !d.id || !/^dep_\d+$/.test(d.id))
          : [];
        const cleanedCards = Array.isArray(parsed.cards)
          ? parsed.cards.filter((c: any) => !c.id || !/^card_\d+$/.test(c.id))
          : [];
        const cleanedDebts = Array.isArray(parsed.debts)
          ? parsed.debts.filter((d: any) => !d.id || !/^debt_\d+$/.test(d.id))
          : [];
        const cleanedGoals = Array.isArray(parsed.goals)
          ? parsed.goals.filter((g: any) => !g.id || !/^goal_\d+$/.test(g.id))
          : [];
        const cleanedRecs = Array.isArray(parsed.recs)
          ? parsed.recs.filter((r: any) => !r.id || !/^rec_\d+$/.test(r.id))
          : [];

        let cleanedAccts = Array.isArray(parsed.accts) ? parsed.accts : [];
        if (cleanedAccts.some((a: any) => a.id === 'acc_vcb' && a.balance === 24500000)) {
          cleanedAccts = getInitialDemoData().accts;
        }

        return {
          records: cleanedRecords,
          settings: { ...getInitialDemoData().settings, ...(parsed.settings || {}) },
          advice: parsed.advice || {},
          assets: Array.isArray(parsed.assets) ? parsed.assets : [],
          debts: cleanedDebts,
          goals: cleanedGoals,
          recs: cleanedRecs,
          cards: cleanedCards,
          accts: cleanedAccts.length > 0 ? cleanedAccts : getInitialDemoData().accts,
          xfers: Array.isArray(parsed.xfers) ? parsed.xfers : [],
          deps: cleanedDeps,
          holds: cleanedHolds,
          nws: parsed.nws || {},
          customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories : [],
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse localStorage data:', e);
  }
  return getInitialDemoData();
}

interface FinanceContextType {
  data: StorageData;
  currentMonth: string;
  setCurrentMonth: (month: string) => void;
  shiftMonth: (offset: number) => void;

  // Cloud Sync State & Actions
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: number | null;
  pendingLocalMigrationCount: number;
  mergeLocalToCloud: () => Promise<boolean>;
  dismissLocalMigration: () => void;
  forceUploadAllToCloud: () => Promise<boolean>;

  // Transactions
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Transaction;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  clearAllTransactions: () => void;

  // Accounts
  addAccount: (acc: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  transferMoney: (fromAccId: string, toAccId: string, amount: number, note?: string) => void;

  // Savings deposits
  addDeposit: (dep: Omit<SavingsDeposit, 'id'>, sourceAccountId?: string) => void;
  updateDeposit: (id: string, updates: Partial<SavingsDeposit>) => void;
  deleteDeposit: (id: string) => void;
  closeDeposit: (id: string, intoAccountId?: string) => void;
  withdrawPartialDeposit: (id: string, withdrawAmount: number, destAccountId: string, note?: string) => void;
  settleFullDeposit: (id: string, destAccountId: string, interestAmount?: number) => void;

  // Investments
  addHolding: (h: Omit<InvestmentHolding, 'id'>, sourceAccountId?: string) => void;
  updateHolding: (id: string, updates: Partial<InvestmentHolding>) => void;
  deleteHolding: (id: string) => void;
  updateHoldingsPrices: (updates: { id: string; currentPrice: number }[]) => void;

  // Cards
  addCreditCard: (card: Omit<CreditCard, 'id'>) => void;
  updateCreditCard: (id: string, updates: Partial<CreditCard>) => void;
  deleteCreditCard: (id: string) => void;
  payCreditCard: (cardId: string, fromAccountId: string, amount: number) => void;

  // Debts
  addDebt: (debt: Omit<DebtItem, 'id'>, sourceAccountId?: string) => void;
  updateDebt: (id: string, updates: Partial<DebtItem>) => void;
  deleteDebt: (id: string) => void;
  recordDebtPayment: (debtId: string, amount: number, accountId?: string) => void;

  // Goals
  addGoal: (goal: Omit<SavingsGoal, 'id'>) => void;
  updateGoal: (id: string, updates: Partial<SavingsGoal>) => void;
  deleteGoal: (id: string) => void;
  contributeGoal: (goalId: string, amount: number, accountId?: string) => void;

  // Recurring
  addRecurring: (rec: Omit<RecurringItem, 'id'>) => void;
  updateRecurring: (id: string, updates: Partial<RecurringItem>) => void;
  deleteRecurring: (id: string) => void;
  recordRecurringNow: (recId: string) => void;

  // Settings & Utilities
  updateSettings: (updates: Partial<AppSettings>) => void;
  togglePrivacyMask: () => void;
  exportBackupJSON: () => void;
  importBackupJSON: (jsonString: string) => boolean;
  resetToSampleData: () => void;
  clearAllAssets: () => void;

  // Custom Categories
  customCategories: CustomCategory[];
  allExpenseCategories: CategoryInfo[];
  allIncomeCategories: CategoryInfo[];
  categoryMap: Record<string, CategoryInfo>;
  addCustomCategory: (cat: Omit<CustomCategory, 'key'> & { key?: string }) => CustomCategory;
  deleteCustomCategory: (key: string) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authReady } = useAuth();
  const [currentMonth, setCurrentMonth] = useState<string>(() => getCurrentMonthString());
  const [data, setData] = useState<StorageData>(() => loadLocalData());

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [pendingLocalData, setPendingLocalData] = useState<StorageData | null>(null);
  const [pendingLocalMigrationCount, setPendingLocalMigrationCount] = useState(0);

  const dataRef = useRef<StorageData>(data);
  dataRef.current = data;

  const activeUidRef = useRef<string | null>(null);
  activeUidRef.current = user?.uid ? sanitizeId(user.uid) : null;

  // Save to localStorage whenever data changes (works as offline/instant cache)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }, [data]);

  // Apply privacy mask class to document root
  useEffect(() => {
    if (data.settings.privacyMask) {
      document.documentElement.classList.add('privacy-mask');
    } else {
      document.documentElement.classList.remove('privacy-mask');
    }
  }, [data.settings.privacyMask]);

  // Apply colorTheme attribute, Light/Dark class, and mobile theme-color meta tag
  useEffect(() => {
    const root = document.documentElement;
    const themeOpt = getColorThemeOption(data.settings.colorTheme);
    if (themeOpt.id === 'emerald') {
      root.removeAttribute('data-color-theme');
    } else {
      root.setAttribute('data-color-theme', themeOpt.id);
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', themeOpt.themeColorHex);
    }

    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const applyAppearance = () => {
      const mode = data.settings.theme || 'light';
      const isDark = mode === 'dark' || (mode === 'system' && Boolean(mq?.matches));
      root.classList.toggle('dark', isDark);
    };

    applyAppearance();
    if (data.settings.theme === 'system' && mq) {
      mq.addEventListener('change', applyAppearance);
      return () => mq.removeEventListener('change', applyAppearance);
    }
  }, [data.settings.colorTheme, data.settings.theme]);

  // Helper to run cloud writes cleanly without crashing React synchronous render
  const runCloudWrite = (task: (uid: string) => Promise<void>) => {
    const uid = activeUidRef.current;
    if (!uid) return;
    setSyncStatus('syncing');
    task(uid)
      .then(() => {
        setSyncStatus('synced');
        setSyncError(null);
        setLastSyncedAt(Date.now());
      })
      .catch(err => {
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Lỗi đồng bộ đám mây');
      });
  };

  // Real-time Firestore listener setup when user logs in
  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setSyncStatus('local');
      setSyncError(null);
      setPendingLocalData(null);
      setPendingLocalMigrationCount(0);
      return;
    }

    const uid = sanitizeId(user.uid);
    let isCancelled = false;
    const unsubscribes: Array<() => void> = [];

    const preLoginSnapshot: StorageData = JSON.parse(JSON.stringify(dataRef.current));
    setSyncStatus('syncing');
    setSyncError(null);

    const cache: {
      settings: AppSettings;
      records: Transaction[];
      accts: Account[];
      cards: CreditCard[];
      deps: SavingsDeposit[];
      holds: InvestmentHolding[];
      debts: DebtItem[];
      goals: SavingsGoal[];
      recs: RecurringItem[];
      xfers: any[];
      customCategories: CustomCategory[];
    } = {
      settings: preLoginSnapshot.settings,
      records: [],
      accts: [],
      cards: [],
      deps: [],
      holds: [],
      debts: [],
      goals: [],
      recs: [],
      xfers: [],
      customCategories: [],
    };

    const loadedFlags = new Set<string>();
    const ALL_KEYS = [
      'settings',
      'transactions',
      'accounts',
      'cards',
      'deposits',
      'holdings',
      'debts',
      'goals',
      'recurrings',
      'transfers',
      'customCategories',
    ];
    let migrationChecked = false;

    const flushCacheToState = () => {
      if (isCancelled) return;

      const sortedRecords = [...cache.records].sort((a, b) => {
        const dCmp = (b.date || '').localeCompare(a.date || '');
        if (dCmp !== 0) return dCmp;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      const nextData: StorageData = {
        records: sortedRecords,
        settings: cache.settings,
        advice: preLoginSnapshot.advice || {},
        assets: preLoginSnapshot.assets || [],
        debts: cache.debts,
        goals: cache.goals,
        recs: cache.recs,
        cards: cache.cards,
        accts: cache.accts,
        xfers: cache.xfers,
        deps: cache.deps,
        holds: cache.holds,
        nws: preLoginSnapshot.nws || {},
        customCategories: cache.customCategories,
      };

      setData(nextData);

      if (loadedFlags.size === ALL_KEYS.length) {
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());

        if (!migrationChecked) {
          migrationChecked = true;
          const cloudTxIds = new Set(cache.records.map(r => r.id));
          const unsyncedTx = (preLoginSnapshot.records || []).filter(r => !cloudTxIds.has(r.id));
          const cloudCardIds = new Set(cache.cards.map(c => c.id));
          const unsyncedCards = (preLoginSnapshot.cards || []).filter(c => !cloudCardIds.has(c.id));
          const cloudDepIds = new Set(cache.deps.map(d => d.id));
          const unsyncedDeps = (preLoginSnapshot.deps || []).filter(d => !cloudDepIds.has(d.id));
          const cloudHoldIds = new Set(cache.holds.map(h => h.id));
          const unsyncedHolds = (preLoginSnapshot.holds || []).filter(h => !cloudHoldIds.has(h.id));

          const extraCount =
            unsyncedTx.length + unsyncedCards.length + unsyncedDeps.length + unsyncedHolds.length;

          if (extraCount > 0) {
            setPendingLocalData(preLoginSnapshot);
            setPendingLocalMigrationCount(extraCount);
          }
        }
      }
    };

    const startSync = async () => {
      try {
        await ensureUserProfileDoc(user);
        if (isCancelled) return;

        const settingsRef = doc(db, 'users', uid, 'settings', 'main');
        const settingsSnap = await getDoc(settingsRef).catch(err =>
          handleFirestoreError(err, OperationType.GET, `users/${uid}/settings/main`)
        );
        if (isCancelled) return;

        // First-ever login on this Google account -> migrate local data to cloud automatically
        if (!settingsSnap.exists()) {
          migrationChecked = true; // no prompt needed since we just uploaded everything
          await uploadLocalLedgerToCloud(uid, preLoginSnapshot);
        }
        if (isCancelled) return;

        // 1. Settings listener
        unsubscribes.push(
          onSnapshot(
            settingsRef,
            snap => {
              if (snap.exists()) {
                cache.settings = fromFirestoreSettings(snap.data());
              }
              loadedFlags.add('settings');
              flushCacheToState();
            },
            err => {
              setSyncStatus('error');
              setSyncError(err.message);
              handleFirestoreError(err, OperationType.GET, `users/${uid}/settings/main`);
            }
          )
        );

        // Helper for owned subcollections
        const subscribeCol = <T,>(
          colName: string,
          mapper: (data: Record<string, any>) => T,
          assign: (items: T[]) => void
        ) => {
          const path = `users/${uid}/${colName}`;
          const q = query(collection(db, 'users', uid, colName), where('ownerId', '==', uid));
          unsubscribes.push(
            onSnapshot(
              q,
              snap => {
                const items = snap.docs.map(d => mapper(d.data()));
                assign(items);
                loadedFlags.add(colName);
                flushCacheToState();
              },
              err => {
                setSyncStatus('error');
                setSyncError(err.message);
                handleFirestoreError(err, OperationType.LIST, path);
              }
            )
          );
        };

        subscribeCol('transactions', fromFirestoreTransaction, items => {
          cache.records = items;
        });
        subscribeCol('accounts', fromFirestoreAccount, items => {
          cache.accts = items;
        });
        subscribeCol('cards', fromFirestoreCard, items => {
          cache.cards = items;
        });
        subscribeCol('deposits', fromFirestoreDeposit, items => {
          cache.deps = items;
        });
        subscribeCol('holdings', fromFirestoreHolding, items => {
          cache.holds = items;
        });
        subscribeCol('debts', fromFirestoreDebt, items => {
          cache.debts = items;
        });
        subscribeCol('goals', fromFirestoreGoal, items => {
          cache.goals = items;
        });
        subscribeCol('recurrings', fromFirestoreRecurring, items => {
          cache.recs = items;
        });
        subscribeCol('transfers', fromFirestoreTransfer, items => {
          cache.xfers = items;
        });
        subscribeCol('customCategories', fromFirestoreCustomCategory, items => {
          cache.customCategories = items;
        });
      } catch (err: any) {
        if (!isCancelled) {
          setSyncStatus('error');
          setSyncError(err?.message || 'Không thể kết nối Firestore');
        }
      }
    };

    startSync();

    return () => {
      isCancelled = true;
      unsubscribes.forEach(fn => {
        try {
          fn();
        } catch {
          // ignore
        }
      });
    };
  }, [user, authReady]);

  const mergeLocalToCloud = async (): Promise<boolean> => {
    const uid = activeUidRef.current;
    if (!uid || !pendingLocalData) return false;

    setSyncStatus('syncing');
    setSyncError(null);
    const cur = dataRef.current;
    const existingIds = new Set<string>();
    cur.records.forEach(r => existingIds.add(`transactions:${sanitizeId(r.id)}`));
    cur.accts.forEach(a => existingIds.add(`accounts:${sanitizeId(a.id)}`));
    cur.cards.forEach(c => existingIds.add(`cards:${sanitizeId(c.id)}`));
    cur.deps.forEach(d => existingIds.add(`deposits:${sanitizeId(d.id)}`));
    cur.holds.forEach(h => existingIds.add(`holdings:${sanitizeId(h.id)}`));
    cur.debts.forEach(d => existingIds.add(`debts:${sanitizeId(d.id)}`));
    cur.goals.forEach(g => existingIds.add(`goals:${sanitizeId(g.id)}`));
    cur.recs.forEach(r => existingIds.add(`recurrings:${sanitizeId(r.id)}`));
    cur.xfers.forEach(x => existingIds.add(`transfers:${sanitizeId(x.id)}`));
    (cur.customCategories || []).forEach(c =>
      existingIds.add(`customCategories:${sanitizeId(c.key)}`)
    );

    try {
      await uploadLocalLedgerToCloud(uid, pendingLocalData, {
        mergeOnly: true,
        existingIds,
      });
      setPendingLocalData(null);
      setPendingLocalMigrationCount(0);
      setSyncStatus('synced');
      setSyncError(null);
      setLastSyncedAt(Date.now());
      return true;
    } catch (err: any) {
      setSyncStatus('error');
      setSyncError(err?.message || 'Lỗi khi gộp dữ liệu');
      return false;
    }
  };

  const dismissLocalMigration = () => {
    setPendingLocalData(null);
    setPendingLocalMigrationCount(0);
  };

  const forceUploadAllToCloud = async (): Promise<boolean> => {
    const uid = activeUidRef.current;
    if (!uid || !user) return false;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      await ensureUserProfileDoc(user);
      await uploadLocalLedgerToCloud(uid, dataRef.current);
      setSyncStatus('synced');
      setSyncError(null);
      setLastSyncedAt(Date.now());
      return true;
    } catch (err: any) {
      setSyncStatus('error');
      setSyncError(err?.message || 'Lỗi đồng bộ lên Đám mây');
      return false;
    }
  };

  // Shift month helper
  const shiftMonth = (offset: number) => {
    setCurrentMonth(prev => shiftMonthString(prev, offset));
  };

  // Transaction operations (supports both Accounts and Credit Cards)
  const addTransaction = (tx: Omit<Transaction, 'id' | 'createdAt'>): Transaction => {
    const newTx: Transaction = {
      ...tx,
      id: 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: Date.now(),
    };

    const prevSnap = dataRef.current;
    let updatedAccount: Account | undefined;
    let updatedCard: CreditCard | undefined;

    if (tx.accountId) {
      const targetAcc = prevSnap.accts.find(a => a.id === tx.accountId);
      if (targetAcc) {
        const diff = tx.type === 'in' ? tx.amount : -tx.amount;
        updatedAccount = { ...targetAcc, balance: targetAcc.balance + diff };
      } else {
        const targetCard = prevSnap.cards.find(c => c.id === tx.accountId);
        if (targetCard) {
          const diff = tx.type === 'out' ? tx.amount : -tx.amount;
          updatedCard = { ...targetCard, currentBalance: Math.max(0, targetCard.currentBalance + diff) };
        }
      }
    }

    setData(prev => {
      let nextAccts = [...prev.accts];
      let nextCards = [...prev.cards];
      if (tx.accountId) {
        if (nextAccts.some(a => a.id === tx.accountId)) {
          nextAccts = nextAccts.map(acc => {
            if (acc.id === tx.accountId) {
              const diff = tx.type === 'in' ? tx.amount : -tx.amount;
              return { ...acc, balance: acc.balance + diff };
            }
            return acc;
          });
        } else {
          nextCards = nextCards.map(c => {
            if (c.id === tx.accountId) {
              const diff = tx.type === 'out' ? tx.amount : -tx.amount;
              return { ...c, currentBalance: Math.max(0, c.currentBalance + diff) };
            }
            return c;
          });
        }
      }

      return {
        ...prev,
        records: [newTx, ...prev.records],
        accts: nextAccts,
        cards: nextCards,
      };
    });

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const txId = sanitizeId(newTx.id);
      batch.set(
        doc(db, 'users', uid, 'transactions', txId),
        toFirestoreTransaction(newTx, uid, true)
      );
      if (updatedAccount) {
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(updatedAccount.id)), {
          balance: updatedAccount.balance,
          updatedAt: serverTimestamp(),
        });
      } else if (updatedCard) {
        batch.update(doc(db, 'users', uid, 'cards', sanitizeId(updatedCard.id)), {
          currentBalance: updatedCard.currentBalance,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/transactions/${txId}`)
      );
    });

    return newTx;
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    const prevSnap = dataRef.current;
    const oldTx = prevSnap.records.find(r => r.id === id);
    if (!oldTx) return;

    const mergedTx: Transaction = { ...oldTx, ...updates };
    const oldAccountId = oldTx.accountId;
    const newAccountId = updates.accountId !== undefined ? updates.accountId : oldAccountId;
    const oldAmount = oldTx.amount;
    const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;
    const oldType = oldTx.type;
    const newType = updates.type !== undefined ? updates.type : oldType;

    // Compute updated account & card maps for both local and Firestore
    const accMap = new Map(prevSnap.accts.map(a => [a.id, { ...a }]));
    const cardMap = new Map(prevSnap.cards.map(c => [c.id, { ...c }]));
    const touchedAccIds = new Set<string>();
    const touchedCardIds = new Set<string>();

    if (oldAccountId) {
      if (accMap.has(oldAccountId)) {
        const a = accMap.get(oldAccountId)!;
        a.balance += oldType === 'in' ? -oldAmount : oldAmount;
        touchedAccIds.add(oldAccountId);
      } else if (cardMap.has(oldAccountId)) {
        const c = cardMap.get(oldAccountId)!;
        c.currentBalance = Math.max(0, c.currentBalance + (oldType === 'out' ? -oldAmount : oldAmount));
        touchedCardIds.add(oldAccountId);
      }
    }
    if (newAccountId) {
      if (accMap.has(newAccountId)) {
        const a = accMap.get(newAccountId)!;
        a.balance += newType === 'in' ? newAmount : -newAmount;
        touchedAccIds.add(newAccountId);
      } else if (cardMap.has(newAccountId)) {
        const c = cardMap.get(newAccountId)!;
        c.currentBalance = Math.max(0, c.currentBalance + (newType === 'out' ? newAmount : -newAmount));
        touchedCardIds.add(newAccountId);
      }
    }

    setData(prev => ({
      ...prev,
      records: prev.records.map(r => (r.id === id ? { ...r, ...updates } : r)),
      accts: prev.accts.map(a => accMap.get(a.id) || a),
      cards: prev.cards.map(c => cardMap.get(c.id) || c),
    }));

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const txId = sanitizeId(id);
      batch.update(
        doc(db, 'users', uid, 'transactions', txId),
        toFirestoreTransaction(mergedTx, uid, false)
      );
      touchedAccIds.forEach(accId => {
        const a = accMap.get(accId)!;
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(accId)), {
          balance: a.balance,
          updatedAt: serverTimestamp(),
        });
      });
      touchedCardIds.forEach(cardId => {
        const c = cardMap.get(cardId)!;
        batch.update(doc(db, 'users', uid, 'cards', sanitizeId(cardId)), {
          currentBalance: c.currentBalance,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/transactions/${txId}`)
      );
    });
  };

  const deleteTransaction = (id: string) => {
    const prevSnap = dataRef.current;
    const oldTx = prevSnap.records.find(r => r.id === id);

    let updatedAcc: Account | undefined;
    let updatedCard: CreditCard | undefined;

    if (oldTx && oldTx.accountId) {
      const acc = prevSnap.accts.find(a => a.id === oldTx.accountId);
      if (acc) {
        const revert = oldTx.type === 'in' ? -oldTx.amount : oldTx.amount;
        updatedAcc = { ...acc, balance: acc.balance + revert };
      } else {
        const card = prevSnap.cards.find(c => c.id === oldTx.accountId);
        if (card) {
          const revert = oldTx.type === 'out' ? -oldTx.amount : oldTx.amount;
          updatedCard = { ...card, currentBalance: Math.max(0, card.currentBalance + revert) };
        }
      }
    }

    setData(prev => {
      let nextAccts = [...prev.accts];
      let nextCards = [...prev.cards];
      if (oldTx && oldTx.accountId) {
        if (nextAccts.some(a => a.id === oldTx.accountId)) {
          nextAccts = nextAccts.map(a => {
            if (a.id === oldTx.accountId) {
              const revert = oldTx.type === 'in' ? -oldTx.amount : oldTx.amount;
              return { ...a, balance: a.balance + revert };
            }
            return a;
          });
        } else {
          nextCards = nextCards.map(c => {
            if (c.id === oldTx.accountId) {
              const revert = oldTx.type === 'out' ? -oldTx.amount : oldTx.amount;
              return { ...c, currentBalance: Math.max(0, c.currentBalance + revert) };
            }
            return c;
          });
        }
      }

      return {
        ...prev,
        records: prev.records.filter(r => r.id !== id),
        accts: nextAccts,
        cards: nextCards,
      };
    });

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const txId = sanitizeId(id);
      batch.delete(doc(db, 'users', uid, 'transactions', txId));
      if (updatedAcc) {
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(updatedAcc.id)), {
          balance: updatedAcc.balance,
          updatedAt: serverTimestamp(),
        });
      } else if (updatedCard) {
        batch.update(doc(db, 'users', uid, 'cards', sanitizeId(updatedCard.id)), {
          currentBalance: updatedCard.currentBalance,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/transactions/${txId}`)
      );
    });
  };

  const clearAllTransactions = () => {
    const prevIds = dataRef.current.records.map(r => r.id);
    setData(prev => {
      const next = { ...prev, records: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    runCloudWrite(async uid => {
      for (let i = 0; i < prevIds.length; i += 400) {
        const chunk = prevIds.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(id => batch.delete(doc(db, 'users', uid, 'transactions', sanitizeId(id))));
        await batch.commit().catch(err =>
          handleFirestoreError(err, OperationType.DELETE, `users/${uid}/transactions`)
        );
      }
    });
  };

  // Account operations
  const addAccount = (acc: Omit<Account, 'id'>) => {
    const newAcc: Account = {
      ...acc,
      id: 'acc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    };
    setData(prev => ({ ...prev, accts: [...prev.accts, newAcc] }));

    runCloudWrite(async uid => {
      const id = sanitizeId(newAcc.id);
      await setDoc(doc(db, 'users', uid, 'accounts', id), toFirestoreAccount(newAcc, uid, true)).catch(
        err => handleFirestoreError(err, OperationType.CREATE, `users/${uid}/accounts/${id}`)
      );
    });
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    const oldAcc = dataRef.current.accts.find(a => a.id === id);
    if (!oldAcc) return;
    const mergedAcc = { ...oldAcc, ...updates };

    setData(prev => ({
      ...prev,
      accts: prev.accts.map(a => (a.id === id ? mergedAcc : a)),
    }));

    runCloudWrite(async uid => {
      const accId = sanitizeId(id);
      await updateDoc(
        doc(db, 'users', uid, 'accounts', accId),
        toFirestoreAccount(mergedAcc, uid, false)
      ).catch(err =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/accounts/${accId}`)
      );
    });
  };

  const deleteAccount = (id: string) => {
    setData(prev => ({
      ...prev,
      accts: prev.accts.filter(a => a.id !== id),
    }));

    runCloudWrite(async uid => {
      const accId = sanitizeId(id);
      await deleteDoc(doc(db, 'users', uid, 'accounts', accId)).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/accounts/${accId}`)
      );
    });
  };

  const transferMoney = (fromAccId: string, toAccId: string, amount: number, note?: string) => {
    if (fromAccId === toAccId || amount <= 0) return;
    const prevSnap = dataRef.current;
    const fromAcc = prevSnap.accts.find(a => a.id === fromAccId);
    const toAcc = prevSnap.accts.find(a => a.id === toAccId);
    if (!fromAcc || !toAcc) return;

    const newFromBal = fromAcc.balance - amount;
    const newToBal = toAcc.balance + amount;
    const xferRecord = {
      id: 'xfer_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      fromId: fromAccId,
      toId: toAccId,
      amount,
      note: note || `Chuyển từ ${fromAcc.name} sang ${toAcc.name}`,
      date: getTodayDateString(),
    };

    setData(prev => ({
      ...prev,
      accts: prev.accts.map(a => {
        if (a.id === fromAccId) return { ...a, balance: a.balance - amount };
        if (a.id === toAccId) return { ...a, balance: a.balance + amount };
        return a;
      }),
      xfers: [xferRecord, ...(prev.xfers || [])],
    }));

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const xferId = sanitizeId(xferRecord.id);
      batch.set(
        doc(db, 'users', uid, 'transfers', xferId),
        toFirestoreTransfer(xferRecord, uid, true)
      );
      batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(fromAccId)), {
        balance: newFromBal,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(toAccId)), {
        balance: newToBal,
        updatedAt: serverTimestamp(),
      });
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/transfers/${xferId}`)
      );
    });
  };

  // Savings deposits
  const addDeposit = (dep: Omit<SavingsDeposit, 'id'>, sourceAccountId?: string) => {
    const newDep: SavingsDeposit = {
      ...dep,
      id: 'dep_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    };

    const prevSnap = dataRef.current;
    const sourceAcc = sourceAccountId
      ? prevSnap.accts.find(a => a.id === sourceAccountId)
      : undefined;
    const newTx: Transaction | null = sourceAccountId
      ? {
          id: 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'out',
          cat: 'tiet_kiem',
          amount: dep.amount,
          date: dep.startDate || getTodayDateString(),
          note: `Gửi sổ tiết kiệm ${dep.bank} (Kỳ hạn ${dep.termMonths}T - ${dep.interestRate}%/năm)`,
          accountId: sourceAccountId,
          createdAt: Date.now(),
        }
      : null;

    setData(prev => {
      let nextAccts = [...prev.accts];
      let nextRecords = [...prev.records];
      if (sourceAccountId) {
        nextAccts = nextAccts.map(a =>
          a.id === sourceAccountId ? { ...a, balance: a.balance - dep.amount } : a
        );
        if (newTx) nextRecords = [newTx, ...nextRecords];
      }
      return {
        ...prev,
        deps: [...prev.deps, newDep],
        accts: nextAccts,
        records: nextRecords,
      };
    });

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const depId = sanitizeId(newDep.id);
      batch.set(doc(db, 'users', uid, 'deposits', depId), toFirestoreDeposit(newDep, uid, true));
      if (sourceAccountId && sourceAcc) {
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(sourceAccountId)), {
          balance: sourceAcc.balance - dep.amount,
          updatedAt: serverTimestamp(),
        });
      }
      if (newTx) {
        batch.set(
          doc(db, 'users', uid, 'transactions', sanitizeId(newTx.id)),
          toFirestoreTransaction(newTx, uid, true)
        );
      }
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/deposits/${depId}`)
      );
    });
  };

  const updateDeposit = (id: string, updates: Partial<SavingsDeposit>) => {
    const oldDep = dataRef.current.deps.find(d => d.id === id);
    if (!oldDep) return;
    const merged = { ...oldDep, ...updates };

    setData(prev => ({
      ...prev,
      deps: prev.deps.map(d => (d.id === id ? merged : d)),
    }));

    if (oldDep.closed) return;

    runCloudWrite(async uid => {
      const depId = sanitizeId(id);
      await updateDoc(
        doc(db, 'users', uid, 'deposits', depId),
        toFirestoreDeposit(merged, uid, false)
      ).catch(err =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/deposits/${depId}`)
      );
    });
  };

  const deleteDeposit = (id: string) => {
    setData(prev => ({
      ...prev,
      deps: prev.deps.filter(d => d.id !== id),
    }));

    runCloudWrite(async uid => {
      const depId = sanitizeId(id);
      await deleteDoc(doc(db, 'users', uid, 'deposits', depId)).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/deposits/${depId}`)
      );
    });
  };

  const closeDeposit = (id: string, intoAccountId?: string) => {
    const prevSnap = dataRef.current;
    const dep = prevSnap.deps.find(d => d.id === id);
    if (!dep || dep.closed) return;

    const targetAcc = intoAccountId ? prevSnap.accts.find(a => a.id === intoAccountId) : undefined;

    setData(prev => {
      let nextAccts = [...prev.accts];
      if (intoAccountId) {
        nextAccts = nextAccts.map(a =>
          a.id === intoAccountId ? { ...a, balance: a.balance + dep.amount } : a
        );
      }
      return {
        ...prev,
        deps: prev.deps.map(d => (d.id === id ? { ...d, closed: true } : d)),
        accts: nextAccts,
      };
    });

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const depId = sanitizeId(id);
      batch.update(doc(db, 'users', uid, 'deposits', depId), {
        closed: true,
        updatedAt: serverTimestamp(),
      });
      if (intoAccountId && targetAcc) {
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(intoAccountId)), {
          balance: targetAcc.balance + dep.amount,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/deposits/${depId}`)
      );
    });
  };

  const withdrawPartialDeposit = (
    id: string,
    withdrawAmount: number,
    destAccountId: string,
    note?: string
  ) => {
    if (withdrawAmount <= 0) return;
    const prevSnap = dataRef.current;
    const dep = prevSnap.deps.find(d => d.id === id);
    if (!dep || dep.closed || withdrawAmount > dep.amount) return;

    const remainingPrincipal = dep.amount - withdrawAmount;
    const nextClosed = remainingPrincipal <= 0 ? true : Boolean(dep.closed);
    const destAcc = prevSnap.accts.find(a => a.id === destAccountId);

    const tx: Transaction = {
      id: 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: 'in',
      cat: 'tiet_kiem',
      amount: withdrawAmount,
      date: getTodayDateString(),
      note: note || `Rút một phần gốc sổ tiết kiệm ${dep.bank}`,
      accountId: destAccountId,
      createdAt: Date.now(),
    };

    setData(prev => ({
      ...prev,
      deps: prev.deps.map(d =>
        d.id === id ? { ...d, amount: remainingPrincipal, closed: nextClosed } : d
      ),
      accts: prev.accts.map(a =>
        a.id === destAccountId ? { ...a, balance: a.balance + withdrawAmount } : a
      ),
      records: [tx, ...prev.records],
    }));

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const depId = sanitizeId(id);
      batch.update(doc(db, 'users', uid, 'deposits', depId), {
        amount: remainingPrincipal,
        closed: nextClosed,
        updatedAt: serverTimestamp(),
      });
      if (destAcc) {
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(destAccountId)), {
          balance: destAcc.balance + withdrawAmount,
          updatedAt: serverTimestamp(),
        });
      }
      batch.set(
        doc(db, 'users', uid, 'transactions', sanitizeId(tx.id)),
        toFirestoreTransaction(tx, uid, true)
      );
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/deposits/${depId}`)
      );
    });
  };

  const settleFullDeposit = (id: string, destAccountId: string, interestAmount: number = 0) => {
    const prevSnap = dataRef.current;
    const dep = prevSnap.deps.find(d => d.id === id);
    if (!dep || dep.closed) return;

    const totalReturn = dep.amount + interestAmount;
    const destAcc = prevSnap.accts.find(a => a.id === destAccountId);

    const txPrincipal: Transaction = {
      id: 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: 'in',
      cat: 'tiet_kiem',
      amount: dep.amount,
      date: getTodayDateString(),
      note: `Tất toán tiền gốc sổ tiết kiệm ${dep.bank}`,
      accountId: destAccountId,
      createdAt: Date.now(),
    };

    const newRecords: Transaction[] = [txPrincipal];
    if (interestAmount > 0) {
      newRecords.push({
        id: 'tx_' + (Date.now() + 1).toString(36) + Math.random().toString(36).slice(2, 6),
        type: 'in',
        cat: 'loi_dau_tu',
        amount: interestAmount,
        date: getTodayDateString(),
        note: `Tiền lãi tất toán sổ tiết kiệm ${dep.bank}`,
        accountId: destAccountId,
        createdAt: Date.now() + 1,
      });
    }

    setData(prev => ({
      ...prev,
      deps: prev.deps.map(d => (d.id === id ? { ...d, closed: true } : d)),
      accts: prev.accts.map(a =>
        a.id === destAccountId ? { ...a, balance: a.balance + totalReturn } : a
      ),
      records: [...newRecords, ...prev.records],
    }));

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const depId = sanitizeId(id);
      batch.update(doc(db, 'users', uid, 'deposits', depId), {
        closed: true,
        updatedAt: serverTimestamp(),
      });
      if (destAcc) {
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(destAccountId)), {
          balance: destAcc.balance + totalReturn,
          updatedAt: serverTimestamp(),
        });
      }
      newRecords.forEach(r => {
        batch.set(
          doc(db, 'users', uid, 'transactions', sanitizeId(r.id)),
          toFirestoreTransaction(r, uid, true)
        );
      });
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/deposits/${depId}`)
      );
    });
  };

  // Investments
  const addHolding = (h: Omit<InvestmentHolding, 'id'>, sourceAccountId?: string) => {
    const newH: InvestmentHolding = {
      ...h,
      id: 'inv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    };

    const prevSnap = dataRef.current;
    const totalCost = Math.round(h.quantity * h.buyPrice);
    const sourceAcc = sourceAccountId
      ? prevSnap.accts.find(a => a.id === sourceAccountId)
      : undefined;

    const newTx: Transaction | null = sourceAccountId
      ? {
          id: 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          type: 'out',
          cat: 'tiet_kiem',
          amount: totalCost,
          date: getTodayDateString(),
          note: `Mua đầu tư: ${h.name || h.code} (${h.quantity} x ${formatVND(h.buyPrice)})`,
          accountId: sourceAccountId,
          createdAt: Date.now(),
        }
      : null;

    setData(prev => {
      let nextAccts = [...prev.accts];
      let nextRecords = [...prev.records];
      if (sourceAccountId) {
        nextAccts = nextAccts.map(a =>
          a.id === sourceAccountId ? { ...a, balance: a.balance - totalCost } : a
        );
        if (newTx) nextRecords = [newTx, ...nextRecords];
      }
      return {
        ...prev,
        holds: [...prev.holds, newH],
        accts: nextAccts,
        records: nextRecords,
      };
    });

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const holdId = sanitizeId(newH.id);
      batch.set(doc(db, 'users', uid, 'holdings', holdId), toFirestoreHolding(newH, uid, true));
      if (sourceAccountId && sourceAcc) {
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(sourceAccountId)), {
          balance: sourceAcc.balance - totalCost,
          updatedAt: serverTimestamp(),
        });
      }
      if (newTx) {
        batch.set(
          doc(db, 'users', uid, 'transactions', sanitizeId(newTx.id)),
          toFirestoreTransaction(newTx, uid, true)
        );
      }
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/holdings/${holdId}`)
      );
    });
  };

  const updateHolding = (id: string, updates: Partial<InvestmentHolding>) => {
    const oldH = dataRef.current.holds.find(h => h.id === id);
    if (!oldH) return;
    const merged = { ...oldH, ...updates };

    setData(prev => ({
      ...prev,
      holds: prev.holds.map(h => (h.id === id ? merged : h)),
    }));

    runCloudWrite(async uid => {
      const holdId = sanitizeId(id);
      await updateDoc(
        doc(db, 'users', uid, 'holdings', holdId),
        toFirestoreHolding(merged, uid, false)
      ).catch(err =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/holdings/${holdId}`)
      );
    });
  };

  const deleteHolding = (id: string) => {
    setData(prev => ({
      ...prev,
      holds: prev.holds.filter(h => h.id !== id),
    }));

    runCloudWrite(async uid => {
      const holdId = sanitizeId(id);
      await deleteDoc(doc(db, 'users', uid, 'holdings', holdId)).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/holdings/${holdId}`)
      );
    });
  };

  const updateHoldingsPrices = (updates: { id: string; currentPrice: number }[]) => {
    setData(prev => {
      const priceMap = new Map(updates.map(u => [u.id, u.currentPrice]));
      const nextHolds = prev.holds.map(h =>
        priceMap.has(h.id) ? { ...h, currentPrice: priceMap.get(h.id)! } : h
      );
      const next = { ...prev, holds: nextHolds };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    if (updates.length > 0) {
      runCloudWrite(async uid => {
        const batch = writeBatch(db);
        updates.forEach(u => {
          batch.update(doc(db, 'users', uid, 'holdings', sanitizeId(u.id)), {
            currentPrice: Math.max(0, Number(u.currentPrice) || 0),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit().catch(err =>
          handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/holdings`)
        );
      });
    }
  };

  // Credit cards
  const addCreditCard = (card: Omit<CreditCard, 'id'>) => {
    const newCard: CreditCard = {
      ...card,
      id: 'card_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    };
    setData(prev => ({ ...prev, cards: [...prev.cards, newCard] }));

    runCloudWrite(async uid => {
      const cardId = sanitizeId(newCard.id);
      await setDoc(doc(db, 'users', uid, 'cards', cardId), toFirestoreCard(newCard, uid, true)).catch(
        err => handleFirestoreError(err, OperationType.CREATE, `users/${uid}/cards/${cardId}`)
      );
    });
  };

  const updateCreditCard = (id: string, updates: Partial<CreditCard>) => {
    const oldCard = dataRef.current.cards.find(c => c.id === id);
    if (!oldCard) return;
    const merged = { ...oldCard, ...updates };

    setData(prev => ({
      ...prev,
      cards: prev.cards.map(c => (c.id === id ? merged : c)),
    }));

    runCloudWrite(async uid => {
      const cardId = sanitizeId(id);
      await updateDoc(
        doc(db, 'users', uid, 'cards', cardId),
        toFirestoreCard(merged, uid, false)
      ).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/cards/${cardId}`));
    });
  };

  const deleteCreditCard = (id: string) => {
    setData(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== id),
    }));

    runCloudWrite(async uid => {
      const cardId = sanitizeId(id);
      await deleteDoc(doc(db, 'users', uid, 'cards', cardId)).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/cards/${cardId}`)
      );
    });
  };

  const payCreditCard = (cardId: string, fromAccountId: string, amount: number) => {
    if (amount <= 0) return;
    const prevSnap = dataRef.current;
    const card = prevSnap.cards.find(c => c.id === cardId);
    if (!card) return;

    const fromAcc = prevSnap.accts.find(a => a.id === fromAccountId);
    const newCardBalance = Math.max(0, card.currentBalance - amount);

    const payTx: Transaction = {
      id: 'tx_pay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      type: 'out',
      cat: 'tra_no',
      amount,
      date: getTodayDateString(),
      note: `Thanh toán dư nợ thẻ ${card.name}`,
      accountId: fromAccountId,
      createdAt: Date.now(),
    };

    setData(prev => ({
      ...prev,
      cards: prev.cards.map(c => (c.id === cardId ? { ...c, currentBalance: newCardBalance } : c)),
      accts: prev.accts.map(a =>
        a.id === fromAccountId ? { ...a, balance: a.balance - amount } : a
      ),
      records: [payTx, ...prev.records],
    }));

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const cid = sanitizeId(cardId);
      batch.update(doc(db, 'users', uid, 'cards', cid), {
        currentBalance: newCardBalance,
        updatedAt: serverTimestamp(),
      });
      if (fromAcc) {
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(fromAccountId)), {
          balance: fromAcc.balance - amount,
          updatedAt: serverTimestamp(),
        });
      }
      batch.set(
        doc(db, 'users', uid, 'transactions', sanitizeId(payTx.id)),
        toFirestoreTransaction(payTx, uid, true)
      );
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/cards/${cid}`)
      );
    });
  };

  // Debts
  const addDebt = (debt: Omit<DebtItem, 'id'>, sourceAccountId?: string) => {
    const newDebt: DebtItem = {
      ...debt,
      id: 'debt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    };

    const prevSnap = dataRef.current;
    const sourceAcc =
      debt.dir === 'lend' && sourceAccountId
        ? prevSnap.accts.find(a => a.id === sourceAccountId)
        : undefined;

    const newTx: Transaction | null =
      debt.dir === 'lend' && sourceAccountId
        ? {
            id: 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            type: 'out',
            cat: 'tra_no',
            amount: debt.amount,
            date: getTodayDateString(),
            note: `Cho vay: ${debt.targetName} (${debt.name})`,
            accountId: sourceAccountId,
            createdAt: Date.now(),
          }
        : null;

    setData(prev => {
      let nextAccts = [...prev.accts];
      let nextRecords = [...prev.records];
      if (debt.dir === 'lend' && sourceAccountId) {
        nextAccts = nextAccts.map(a =>
          a.id === sourceAccountId ? { ...a, balance: a.balance - debt.amount } : a
        );
        if (newTx) nextRecords = [newTx, ...nextRecords];
      }
      return {
        ...prev,
        debts: [...prev.debts, newDebt],
        accts: nextAccts,
        records: nextRecords,
      };
    });

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const did = sanitizeId(newDebt.id);
      batch.set(doc(db, 'users', uid, 'debts', did), toFirestoreDebt(newDebt, uid, true));
      if (sourceAccountId && sourceAcc) {
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(sourceAccountId)), {
          balance: sourceAcc.balance - debt.amount,
          updatedAt: serverTimestamp(),
        });
      }
      if (newTx) {
        batch.set(
          doc(db, 'users', uid, 'transactions', sanitizeId(newTx.id)),
          toFirestoreTransaction(newTx, uid, true)
        );
      }
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/debts/${did}`)
      );
    });
  };

  const updateDebt = (id: string, updates: Partial<DebtItem>) => {
    const oldDebt = dataRef.current.debts.find(d => d.id === id);
    if (!oldDebt) return;
    const merged = { ...oldDebt, ...updates };

    setData(prev => ({
      ...prev,
      debts: prev.debts.map(d => (d.id === id ? merged : d)),
    }));

    if (oldDebt.closed) return;

    runCloudWrite(async uid => {
      const did = sanitizeId(id);
      await updateDoc(doc(db, 'users', uid, 'debts', did), toFirestoreDebt(merged, uid, false)).catch(
        err => handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/debts/${did}`)
      );
    });
  };

  const deleteDebt = (id: string) => {
    setData(prev => ({
      ...prev,
      debts: prev.debts.filter(d => d.id !== id),
    }));

    runCloudWrite(async uid => {
      const did = sanitizeId(id);
      await deleteDoc(doc(db, 'users', uid, 'debts', did)).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/debts/${did}`)
      );
    });
  };

  const recordDebtPayment = (debtId: string, amount: number, accountId?: string) => {
    if (amount <= 0) return;
    const prevSnap = dataRef.current;
    const debt = prevSnap.debts.find(d => d.id === debtId);
    if (!debt || debt.closed) return;

    const newPaid = (debt.paidAmount || 0) + amount;
    const isClosed = newPaid >= debt.amount;
    const isLend = debt.dir === 'lend';
    const targetAcc = accountId ? prevSnap.accts.find(a => a.id === accountId) : undefined;

    const payTx: Transaction | null = accountId
      ? {
          id: 'tx_debt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          type: isLend ? 'in' : 'out',
          cat: isLend ? 'thu_khac' : 'tra_no',
          amount,
          date: getTodayDateString(),
          note: isLend ? `Thu hồi nợ từ ${debt.targetName}` : `Trả nợ cho ${debt.targetName}`,
          accountId,
          createdAt: Date.now(),
        }
      : null;

    setData(prev => {
      let nextAccts = [...prev.accts];
      let nextRecords = [...prev.records];
      if (accountId) {
        nextAccts = nextAccts.map(a =>
          a.id === accountId ? { ...a, balance: a.balance + (isLend ? amount : -amount) } : a
        );
        if (payTx) nextRecords = [payTx, ...nextRecords];
      }
      return {
        ...prev,
        debts: prev.debts.map(d =>
          d.id === debtId ? { ...d, paidAmount: newPaid, closed: isClosed } : d
        ),
        accts: nextAccts,
        records: nextRecords,
      };
    });

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const did = sanitizeId(debtId);
      batch.update(doc(db, 'users', uid, 'debts', did), {
        paidAmount: newPaid,
        closed: isClosed,
        updatedAt: serverTimestamp(),
      });
      if (accountId && targetAcc) {
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(accountId)), {
          balance: targetAcc.balance + (isLend ? amount : -amount),
          updatedAt: serverTimestamp(),
        });
      }
      if (payTx) {
        batch.set(
          doc(db, 'users', uid, 'transactions', sanitizeId(payTx.id)),
          toFirestoreTransaction(payTx, uid, true)
        );
      }
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/debts/${did}`)
      );
    });
  };

  // Goals
  const addGoal = (goal: Omit<SavingsGoal, 'id'>) => {
    const newGoal: SavingsGoal = {
      ...goal,
      id: 'goal_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    };
    setData(prev => ({ ...prev, goals: [...prev.goals, newGoal] }));

    runCloudWrite(async uid => {
      const gid = sanitizeId(newGoal.id);
      await setDoc(doc(db, 'users', uid, 'goals', gid), toFirestoreGoal(newGoal, uid, true)).catch(
        err => handleFirestoreError(err, OperationType.CREATE, `users/${uid}/goals/${gid}`)
      );
    });
  };

  const updateGoal = (id: string, updates: Partial<SavingsGoal>) => {
    const oldGoal = dataRef.current.goals.find(g => g.id === id);
    if (!oldGoal) return;
    const merged = { ...oldGoal, ...updates };

    setData(prev => ({
      ...prev,
      goals: prev.goals.map(g => (g.id === id ? merged : g)),
    }));

    runCloudWrite(async uid => {
      const gid = sanitizeId(id);
      await updateDoc(doc(db, 'users', uid, 'goals', gid), toFirestoreGoal(merged, uid, false)).catch(
        err => handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/goals/${gid}`)
      );
    });
  };

  const deleteGoal = (id: string) => {
    setData(prev => ({
      ...prev,
      goals: prev.goals.filter(g => g.id !== id),
    }));

    runCloudWrite(async uid => {
      const gid = sanitizeId(id);
      await deleteDoc(doc(db, 'users', uid, 'goals', gid)).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/goals/${gid}`)
      );
    });
  };

  const contributeGoal = (goalId: string, amount: number, accountId?: string) => {
    if (amount <= 0) return;
    const prevSnap = dataRef.current;
    const goal = prevSnap.goals.find(g => g.id === goalId);
    if (!goal) return;

    const newCurrentAmount = goal.currentAmount + amount;
    const targetAcc = accountId ? prevSnap.accts.find(a => a.id === accountId) : undefined;
    const newTx: Transaction | null = accountId
      ? {
          id: 'tx_goal_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          type: 'out',
          cat: 'tiet_kiem',
          amount,
          date: getTodayDateString(),
          note: `Góp mục tiêu: ${goal.title}`,
          accountId,
          createdAt: Date.now(),
        }
      : null;

    setData(prev => {
      let nextAccts = [...prev.accts];
      let nextRecords = [...prev.records];
      if (accountId) {
        nextAccts = nextAccts.map(a =>
          a.id === accountId ? { ...a, balance: a.balance - amount } : a
        );
        if (newTx) nextRecords = [newTx, ...nextRecords];
      }
      return {
        ...prev,
        goals: prev.goals.map(g =>
          g.id === goalId ? { ...g, currentAmount: newCurrentAmount } : g
        ),
        accts: nextAccts,
        records: nextRecords,
      };
    });

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      const gid = sanitizeId(goalId);
      batch.update(doc(db, 'users', uid, 'goals', gid), {
        currentAmount: newCurrentAmount,
        updatedAt: serverTimestamp(),
      });
      if (accountId && targetAcc) {
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(accountId)), {
          balance: targetAcc.balance - amount,
          updatedAt: serverTimestamp(),
        });
      }
      if (newTx) {
        batch.set(
          doc(db, 'users', uid, 'transactions', sanitizeId(newTx.id)),
          toFirestoreTransaction(newTx, uid, true)
        );
      }
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/goals/${gid}`)
      );
    });
  };

  // Recurring
  const addRecurring = (rec: Omit<RecurringItem, 'id'>) => {
    const newRec: RecurringItem = {
      ...rec,
      id: 'rec_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    };
    setData(prev => ({ ...prev, recs: [...prev.recs, newRec] }));

    runCloudWrite(async uid => {
      const rid = sanitizeId(newRec.id);
      await setDoc(
        doc(db, 'users', uid, 'recurrings', rid),
        toFirestoreRecurring(newRec, uid, true)
      ).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${uid}/recurrings/${rid}`));
    });
  };

  const updateRecurring = (id: string, updates: Partial<RecurringItem>) => {
    const oldRec = dataRef.current.recs.find(r => r.id === id);
    if (!oldRec) return;
    const merged = { ...oldRec, ...updates };

    setData(prev => ({
      ...prev,
      recs: prev.recs.map(r => (r.id === id ? merged : r)),
    }));

    runCloudWrite(async uid => {
      const rid = sanitizeId(id);
      await updateDoc(
        doc(db, 'users', uid, 'recurrings', rid),
        toFirestoreRecurring(merged, uid, false)
      ).catch(err =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/recurrings/${rid}`)
      );
    });
  };

  const deleteRecurring = (id: string) => {
    setData(prev => ({
      ...prev,
      recs: prev.recs.filter(r => r.id !== id),
    }));

    runCloudWrite(async uid => {
      const rid = sanitizeId(id);
      await deleteDoc(doc(db, 'users', uid, 'recurrings', rid)).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/recurrings/${rid}`)
      );
    });
  };

  const recordRecurringNow = (recId: string) => {
    const rec = dataRef.current.recs.find(r => r.id === recId);
    if (!rec) return;

    addTransaction({
      type: rec.type,
      cat: rec.cat,
      amount: rec.amount,
      date: getTodayDateString(),
      note: `Khoản định kỳ: ${rec.name}`,
      accountId: rec.accountId,
    });

    updateRecurring(recId, { lastRecorded: getTodayDateString() });
  };

  // Settings
  const updateSettings = (updates: Partial<AppSettings>) => {
    const nextSettings: AppSettings = { ...dataRef.current.settings, ...updates };
    setData(prev => ({
      ...prev,
      settings: nextSettings,
    }));

    runCloudWrite(async uid => {
      await updateDoc(
        doc(db, 'users', uid, 'settings', 'main'),
        toFirestoreSettings(nextSettings, uid, false)
      ).catch(err =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/settings/main`)
      );
    });
  };

  const togglePrivacyMask = () => {
    updateSettings({ privacyMask: !dataRef.current.settings.privacyMask });
  };

  // Backup & Restore
  const exportBackupJSON = () => {
    try {
      const jsonStr = JSON.stringify(dataRef.current, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `sothuchi_backup_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export backup JSON:', e);
    }
  };

  const importBackupJSON = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') return false;

      const validData: StorageData = {
        records: Array.isArray(parsed.records) ? parsed.records : [],
        settings: { ...getInitialDemoData().settings, ...(parsed.settings || {}) },
        advice: parsed.advice || {},
        assets: Array.isArray(parsed.assets) ? parsed.assets : [],
        debts: Array.isArray(parsed.debts) ? parsed.debts : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
        recs: Array.isArray(parsed.recs) ? parsed.recs : [],
        cards: Array.isArray(parsed.cards) ? parsed.cards : [],
        accts: Array.isArray(parsed.accts) ? parsed.accts : [],
        xfers: Array.isArray(parsed.xfers) ? parsed.xfers : [],
        deps: Array.isArray(parsed.deps) ? parsed.deps : [],
        holds: Array.isArray(parsed.holds) ? parsed.holds : [],
        nws: parsed.nws || {},
        customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories : [],
      };

      setData(validData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validData));

      if (activeUidRef.current) {
        runCloudWrite(async uid => {
          await uploadLocalLedgerToCloud(uid, validData);
        });
      }
      return true;
    } catch (e) {
      console.error('Invalid backup file JSON:', e);
      return false;
    }
  };

  const resetToSampleData = () => {
    const fresh = getInitialDemoData();
    setData(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  };

  const clearAllAssets = () => {
    const snap = dataRef.current;
    const next: StorageData = {
      ...snap,
      deps: [],
      holds: [],
      cards: [],
      debts: [],
      goals: [],
      recs: [],
      accts: snap.accts.map(a => ({ ...a, balance: 0 })),
    };

    setData(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Error saving cleared assets:', e);
    }

    runCloudWrite(async uid => {
      const batch = writeBatch(db);
      snap.deps.forEach(d => batch.delete(doc(db, 'users', uid, 'deposits', sanitizeId(d.id))));
      snap.holds.forEach(h => batch.delete(doc(db, 'users', uid, 'holdings', sanitizeId(h.id))));
      snap.cards.forEach(c => batch.delete(doc(db, 'users', uid, 'cards', sanitizeId(c.id))));
      snap.debts.forEach(d => batch.delete(doc(db, 'users', uid, 'debts', sanitizeId(d.id))));
      snap.goals.forEach(g => batch.delete(doc(db, 'users', uid, 'goals', sanitizeId(g.id))));
      snap.recs.forEach(r => batch.delete(doc(db, 'users', uid, 'recurrings', sanitizeId(r.id))));
      snap.accts.forEach(a =>
        batch.update(doc(db, 'users', uid, 'accounts', sanitizeId(a.id)), {
          balance: 0,
          updatedAt: serverTimestamp(),
        })
      );
      await batch.commit().catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}`)
      );
    });
  };

  // Custom category actions
  const addCustomCategory = (
    cat: Omit<CustomCategory, 'key'> & { key?: string }
  ): CustomCategory => {
    const cleanKey = sanitizeId(
      cat.key || 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    );
    const newCat: CustomCategory = {
      ...cat,
      key: cleanKey,
      shortName: cat.shortName || cat.name,
      createdAt: Date.now(),
    };

    setData(prev => ({
      ...prev,
      customCategories: [...(prev.customCategories || []), newCat],
    }));

    runCloudWrite(async uid => {
      await setDoc(
        doc(db, 'users', uid, 'customCategories', cleanKey),
        toFirestoreCustomCategory(newCat, uid, true)
      ).catch(err =>
        handleFirestoreError(err, OperationType.CREATE, `users/${uid}/customCategories/${cleanKey}`)
      );
    });

    return newCat;
  };

  const deleteCustomCategory = (key: string) => {
    setData(prev => ({
      ...prev,
      customCategories: (prev.customCategories || []).filter(c => c.key !== key),
    }));

    runCloudWrite(async uid => {
      const catId = sanitizeId(key);
      await deleteDoc(doc(db, 'users', uid, 'customCategories', catId)).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/customCategories/${catId}`)
      );
    });
  };

  const customCategories = useMemo(() => data.customCategories || [], [data.customCategories]);

  const allExpenseCategories = useMemo<CategoryInfo[]>(() => {
    const customs: CategoryInfo[] = customCategories
      .filter(c => c.type === 'out')
      .map(c => ({
        key: c.key,
        name: c.name,
        shortName: c.shortName || c.name,
        color: c.color || '#EA580C',
        group: c.group || 'need',
        section: c.section || 'Tự tạo',
        iconName: c.iconName || 'Utensils',
      }));
    return [...EXPENSE_CATEGORIES, ...customs];
  }, [customCategories]);

  const allIncomeCategories = useMemo<CategoryInfo[]>(() => {
    const customs: CategoryInfo[] = customCategories
      .filter(c => c.type === 'in')
      .map(c => ({
        key: c.key,
        name: c.name,
        shortName: c.shortName || c.name,
        color: c.color || '#16A34A',
        group: 'income',
        section: c.section || 'Thu nhập',
        iconName: c.iconName || 'Coins',
      }));
    return [...INCOME_CATEGORIES, ...customs];
  }, [customCategories]);

  const categoryMap = useMemo<Record<string, CategoryInfo>>(() => {
    const map: Record<string, CategoryInfo> = { ...CATEGORY_MAP };
    customCategories.forEach(c => {
      map[c.key] = {
        key: c.key,
        name: c.name,
        shortName: c.shortName || c.name,
        color: c.color || (c.type === 'in' ? '#16A34A' : '#EA580C'),
        group: c.group || (c.type === 'in' ? 'income' : 'need'),
        section: c.section || (c.type === 'in' ? 'Thu nhập' : 'Tự tạo'),
        iconName: c.iconName || (c.type === 'in' ? 'Coins' : 'Utensils'),
      };
    });
    return map;
  }, [customCategories]);

  return (
    <FinanceContext.Provider
      value={{
        data,
        currentMonth,
        setCurrentMonth,
        shiftMonth,
        syncStatus,
        syncError,
        lastSyncedAt,
        pendingLocalMigrationCount,
        mergeLocalToCloud,
        dismissLocalMigration,
        forceUploadAllToCloud,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        clearAllTransactions,
        addAccount,
        updateAccount,
        deleteAccount,
        transferMoney,
        addDeposit,
        updateDeposit,
        deleteDeposit,
        closeDeposit,
        withdrawPartialDeposit,
        settleFullDeposit,
        addHolding,
        updateHolding,
        deleteHolding,
        updateHoldingsPrices,
        addCreditCard,
        updateCreditCard,
        deleteCreditCard,
        payCreditCard,
        addDebt,
        updateDebt,
        deleteDebt,
        recordDebtPayment,
        addGoal,
        updateGoal,
        deleteGoal,
        contributeGoal,
        addRecurring,
        updateRecurring,
        deleteRecurring,
        recordRecurringNow,
        updateSettings,
        togglePrivacyMask,
        exportBackupJSON,
        importBackupJSON,
        resetToSampleData,
        clearAllAssets,
        customCategories,
        allExpenseCategories,
        allIncomeCategories,
        categoryMap,
        addCustomCategory,
        deleteCustomCategory,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
