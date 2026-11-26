import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { useFinance } from './FinanceContext';
import { sanitizeId } from '../utils/firestoreSync';
import { DEFAULT_MONTHLY_INCOME, PaydayPlan, PeriodMode, PlusData } from '../types/plus';
import { getPeriodRange, PeriodRange } from '../utils/period';
import { StorageData } from '../types/finance';
import { removeVietnameseAccents } from '../constants/categories';

export const PLUS_STORAGE_KEY = 'sothuchi.plus.v1';

export function getDefaultPlus(): PlusData {
  return {
    version: 1,
    updatedAtMs: 0,
    monthlyIncome: DEFAULT_MONTHLY_INCOME,
    periodMode: 'calendar',
    payrollStartDay: 30,
    paydayPlans: [],
    paydayDone: {},
    cardSelfLimits: {},
    stmtOverrides: {},
    goalDepositLinks: {},
    cashbackToNec: {},
    dismissedAutoTx: {},
    recurringSeeded: false,
  };
}

const isObj = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Chuẩn hoá dữ liệu Plus đọc từ localStorage / file / đám mây (bỏ qua trường hỏng). */
export function normalizePlus(raw: unknown): PlusData {
  const base = getDefaultPlus();
  if (!isObj(raw)) return base;
  const num = (v: any, fb: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
  return {
    version: 1,
    updatedAtMs: num(raw.updatedAtMs, 0),
    monthlyIncome: Math.max(0, num(raw.monthlyIncome, base.monthlyIncome)),
    periodMode: raw.periodMode === 'payroll' ? 'payroll' : 'calendar',
    payrollStartDay: Math.min(31, Math.max(1, Math.round(num(raw.payrollStartDay, 30)))),
    paydayPlans: Array.isArray(raw.paydayPlans)
      ? raw.paydayPlans
          .filter((p: any) => isObj(p) && typeof p.id === 'string')
          .map((p: any) => ({
            id: p.id,
            name: String(p.name || 'Kỳ lương'),
            day: Math.min(31, Math.max(1, Math.round(num(p.day, 1)))),
            items: Array.isArray(p.items)
              ? p.items
                  .filter((it: any) => isObj(it) && typeof it.id === 'string')
                  .map((it: any) => ({
                    id: it.id,
                    label: String(it.label || 'Khoản trích'),
                    amount: Math.max(0, num(it.amount, 0)),
                    kind: ['transfer', 'expense', 'card', 'goal'].includes(it.kind) ? it.kind : 'expense',
                    fromAccountId: typeof it.fromAccountId === 'string' ? it.fromAccountId : undefined,
                    toAccountId: typeof it.toAccountId === 'string' ? it.toAccountId : undefined,
                    cat: typeof it.cat === 'string' ? it.cat : undefined,
                    cardId: typeof it.cardId === 'string' ? it.cardId : undefined,
                    goalId: typeof it.goalId === 'string' ? it.goalId : undefined,
                  }))
              : [],
          }))
      : [],
    paydayDone: isObj(raw.paydayDone) ? { ...raw.paydayDone } : {},
    cardSelfLimits: isObj(raw.cardSelfLimits) ? { ...raw.cardSelfLimits } : {},
    stmtOverrides: isObj(raw.stmtOverrides) ? { ...raw.stmtOverrides } : {},
    goalDepositLinks: isObj(raw.goalDepositLinks) ? { ...raw.goalDepositLinks } : {},
    cashbackToNec: isObj(raw.cashbackToNec) ? { ...raw.cashbackToNec } : {},
    dismissedAutoTx: isObj(raw.dismissedAutoTx) ? { ...raw.dismissedAutoTx } : {},
    recurringSeeded: Boolean(raw.recurringSeeded),
  };
}

function loadPlus(): PlusData {
  try {
    const stored = localStorage.getItem(PLUS_STORAGE_KEY);
    if (stored) return normalizePlus(JSON.parse(stored));
  } catch (e) {
    console.warn('Không đọc được dữ liệu Sổ Plus:', e);
  }
  return getDefaultPlus();
}

const findByName = <T extends { id: string; name?: string; title?: string }>(list: T[], keyword: string) =>
  list.find(x => removeVietnameseAccents(x.name || x.title || '').includes(keyword));

/** Kịch bản chia lương mẫu (dựa trên ví dụ thực tế), tự khớp ví/thẻ/quỹ đang có. */
export function buildDefaultPaydayPlans(data: StorageData): PaydayPlan[] {
  const bank =
    findByName(data.accts, 'tech') ||
    data.accts.find(a => a.type === 'bank') ||
    data.accts[0];
  const vib = findByName(data.cards, 'vib') || data.cards[0];
  const tetGoal = findByName(data.goals, 'tet');
  return [
    {
      id: 'plan_k1',
      name: 'Kỳ 1',
      day: 30,
      items: [
        tetGoal
          ? { id: 'k1_tet', label: 'Trích Quỹ Tết', amount: 10_500_000, kind: 'goal', goalId: tetGoal.id, fromAccountId: bank?.id }
          : { id: 'k1_tet', label: 'Trích Quỹ Tết', amount: 10_500_000, kind: 'expense', cat: 'tiet_kiem', fromAccountId: bank?.id },
        { id: 'k1_dien_nuoc', label: 'Đóng điện nước', amount: 3_900_000, kind: 'expense', cat: 'dien', fromAccountId: bank?.id },
      ],
    },
    {
      id: 'plan_k2',
      name: 'Kỳ 2',
      day: 10,
      items: vib
        ? [{ id: 'k2_vib', label: `Trả sao kê thẻ ${vib.name}`, amount: 7_060_000, kind: 'card', cardId: vib.id, fromAccountId: bank?.id }]
        : [],
    },
  ];
}

interface PlusContextType {
  plus: PlusData;
  updatePlus: (updater: Partial<PlusData> | ((prev: PlusData) => Partial<PlusData>)) => void;
  /** Kịch bản chia lương (mặc định nếu người dùng chưa cấu hình) */
  paydayPlans: PaydayPlan[];
  // Kỳ thời gian
  periodMode: PeriodMode;
  setPeriodMode: (mode: PeriodMode) => void;
  periodRange: PeriodRange;
  getRangeForMonth: (month: string) => PeriodRange;
  isInPeriod: (date: string | undefined) => boolean;
  // Sao lưu
  exportFullBackup: () => void;
  importFullBackup: (json: string) => boolean;
  plusCloudState: 'off' | 'synced' | 'blocked';
}

const PlusContext = createContext<PlusContextType | undefined>(undefined);

export const PlusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authReady } = useAuth();
  const { data, currentMonth, importBackupJSON } = useFinance();
  const [plus, setPlus] = useState<PlusData>(() => loadPlus());
  const [plusCloudState, setPlusCloudState] = useState<'off' | 'synced' | 'blocked'>('off');

  const plusRef = useRef(plus);
  plusRef.current = plus;
  const lastCloudStampRef = useRef<number>(-1);
  const cloudReadyRef = useRef(false);
  const cloudBlockedRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(PLUS_STORAGE_KEY, JSON.stringify(plus));
    } catch (e) {
      console.error('Không lưu được Sổ Plus:', e);
    }
  }, [plus]);

  const updatePlus = useCallback<PlusContextType['updatePlus']>(updater => {
    setPlus(prev => {
      const patch = typeof updater === 'function' ? updater(prev) : updater;
      return { ...prev, ...patch, updatedAtMs: Date.now() };
    });
  }, []);

  // Đồng bộ đám mây (tài liệu riêng users/{uid}/plus/main). Nếu luật Firestore chưa
  // được triển khai, thao tác bị từ chối → giữ nguyên chế độ lưu trên máy, không ảnh hưởng sổ chính.
  useEffect(() => {
    cloudReadyRef.current = false;
    if (!authReady || !user) {
      setPlusCloudState('off');
      return;
    }
    let cancelled = false;
    const uid = sanitizeId(user.uid);
    const ref = doc(db, 'users', uid, 'plus', 'main');
    getDoc(ref)
      .then(snap => {
        if (cancelled) return;
        const cloud = snap.exists() ? snap.data() : null;
        if (cloud && typeof cloud.payload === 'string') {
          const parsed = normalizePlus(JSON.parse(cloud.payload));
          if (parsed.updatedAtMs > plusRef.current.updatedAtMs) {
            lastCloudStampRef.current = parsed.updatedAtMs;
            setPlus(parsed);
          }
        }
        cloudReadyRef.current = true;
        cloudBlockedRef.current = false;
        setPlusCloudState('synced');
      })
      .catch(err => {
        if (cancelled) return;
        cloudBlockedRef.current = true;
        setPlusCloudState('blocked');
        console.warn('Sổ Plus: chưa đồng bộ được đám mây (dữ liệu vẫn lưu trên máy).', err?.message || err);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!user || !cloudReadyRef.current || cloudBlockedRef.current) return;
    if (plus.updatedAtMs === 0 || plus.updatedAtMs === lastCloudStampRef.current) return;
    const uid = sanitizeId(user.uid);
    const timer = setTimeout(() => {
      setDoc(doc(db, 'users', uid, 'plus', 'main'), {
        ownerId: uid,
        payload: JSON.stringify(plusRef.current),
        updatedAtMs: plusRef.current.updatedAtMs,
      })
        .then(() => {
          lastCloudStampRef.current = plusRef.current.updatedAtMs;
          setPlusCloudState('synced');
        })
        .catch(err => {
          cloudBlockedRef.current = true;
          setPlusCloudState('blocked');
          console.warn('Sổ Plus: ghi đám mây bị từ chối, tiếp tục lưu trên máy.', err?.message || err);
        });
    }, 1200);
    return () => clearTimeout(timer);
  }, [plus, user]);

  const paydayPlans = useMemo(
    () => (plus.paydayPlans.length > 0 ? plus.paydayPlans : buildDefaultPaydayPlans(data)),
    [plus.paydayPlans, data.accts, data.cards, data.goals]
  );

  const getRangeForMonth = useCallback(
    (month: string) => getPeriodRange(month, plus.periodMode, plus.payrollStartDay),
    [plus.periodMode, plus.payrollStartDay]
  );

  const periodRange = useMemo(() => getRangeForMonth(currentMonth), [getRangeForMonth, currentMonth]);

  const isInPeriod = useCallback(
    (date: string | undefined) => Boolean(date) && date! >= periodRange.start && date! <= periodRange.end,
    [periodRange]
  );

  const setPeriodMode = useCallback((mode: PeriodMode) => updatePlus({ periodMode: mode }), [updatePlus]);

  const exportFullBackup = useCallback(() => {
    try {
      const payload = { ...data, plus: plusRef.current };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
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
      console.error('Xuất sao lưu thất bại:', e);
    }
  }, [data]);

  const importFullBackup = useCallback(
    (json: string): boolean => {
      const ok = importBackupJSON(json);
      if (!ok) return false;
      try {
        const parsed = JSON.parse(json);
        if (parsed && parsed.plus) {
          setPlus({ ...normalizePlus(parsed.plus), updatedAtMs: Date.now() });
        }
      } catch {
        // File hợp lệ với sổ chính nhưng không có phần Plus → giữ cấu hình hiện tại
      }
      return true;
    },
    [importBackupJSON]
  );

  const value: PlusContextType = {
    plus,
    updatePlus,
    paydayPlans,
    periodMode: plus.periodMode,
    setPeriodMode,
    periodRange,
    getRangeForMonth,
    isInPeriod,
    exportFullBackup,
    importFullBackup,
    plusCloudState,
  };

  return <PlusContext.Provider value={value}>{children}</PlusContext.Provider>;
};

export const usePlus = () => {
  const ctx = useContext(PlusContext);
  if (!ctx) throw new Error('usePlus must be used within a PlusProvider');
  return ctx;
};
