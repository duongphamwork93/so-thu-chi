import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  CreditCard,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react';
import { BottomSheet, inputClass, labelClass } from '../ui/BottomSheet';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { PaydayItem, PaydayItemKind, PaydayPlan } from '../../types/plus';
import { formatVND, formatVNDShort, getTodayDateString } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { latestPaydayDate, nextPaydayDate } from '../../utils/period';
import { showToast } from '../../utils/toast';

interface PaydayChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlanId?: string;
}

const KIND_META: Record<PaydayItemKind, { label: string; icon: React.ElementType; hint: string }> = {
  goal: { label: 'Trích quỹ mục tiêu', icon: PiggyBank, hint: 'Nạp vào Quỹ mục tiêu' },
  expense: { label: 'Ghi chi tiêu', icon: Receipt, hint: 'Ghi chi vào danh mục → hũ' },
  card: { label: 'Trả thẻ tín dụng', icon: CreditCard, hint: 'Thanh toán sao kê thẻ' },
  transfer: { label: 'Chuyển khoản nội bộ', icon: ArrowRightLeft, hint: 'Chuyển giữa 2 ví' },
};

export const paydayDoneKey = (planId: string, itemId: string, paydayDate: string) =>
  `${planId}:${itemId}:${paydayDate}`;

const newId = (prefix: string) => prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

const shortDate = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export const PaydayChecklistModal: React.FC<PaydayChecklistModalProps> = ({ isOpen, onClose, initialPlanId }) => {
  const {
    data,
    allExpenseCategories,
    categoryMap,
    addTransaction,
    deleteTransaction,
    transferMoney,
    payCreditCard,
    contributeGoal,
  } = useFinance();
  const { plus, updatePlus, paydayPlans } = usePlus();

  const [activePlanId, setActivePlanId] = useState<string>(paydayPlans[0]?.id || '');
  const [isEditing, setIsEditing] = useState(false);
  const [draftPlans, setDraftPlans] = useState<PaydayPlan[]>(paydayPlans);

  useEffect(() => {
    if (!isOpen) return;
    setIsEditing(false);
    setDraftPlans(paydayPlans);
    const todayStr = getTodayDateString();
    // Mặc định mở kỳ lương gần nhất vừa diễn ra
    const sorted = [...paydayPlans].sort((a, b) =>
      latestPaydayDate(b.day, todayStr).localeCompare(latestPaydayDate(a.day, todayStr))
    );
    setActivePlanId(initialPlanId || sorted[0]?.id || paydayPlans[0]?.id || '');
  }, [isOpen]);

  const todayStr = getTodayDateString();
  const plans = isEditing ? draftPlans : paydayPlans;
  const activePlan = plans.find(p => p.id === activePlanId) || plans[0];
  const paydayDate = activePlan ? latestPaydayDate(activePlan.day, todayStr) : todayStr;

  const accountName = (id?: string) => data.accts.find(a => a.id === id)?.name || '';
  const describeItem = (it: PaydayItem): string => {
    const from = accountName(it.fromAccountId);
    switch (it.kind) {
      case 'transfer':
        return `${from || '?'} → ${accountName(it.toAccountId) || '?'}`;
      case 'expense':
        return `${categoryMap[it.cat || '']?.name || 'Chi khác'} · từ ${from || '?'}`;
      case 'card':
        return `${data.cards.find(c => c.id === it.cardId)?.name || 'Thẻ ?'} · từ ${from || '?'}`;
      case 'goal':
        return `${data.goals.find(g => g.id === it.goalId)?.title || 'Quỹ ?'} · từ ${from || 'không trừ ví'}`;
    }
  };

  const progress = useMemo(() => {
    if (!activePlan) return { done: 0, total: 0, doneAmt: 0, totalAmt: 0 };
    let done = 0;
    let doneAmt = 0;
    activePlan.items.forEach(it => {
      if (plus.paydayDone[paydayDoneKey(activePlan.id, it.id, paydayDate)]) {
        done++;
        doneAmt += it.amount;
      }
    });
    return {
      done,
      total: activePlan.items.length,
      doneAmt,
      totalAmt: activePlan.items.reduce((s, it) => s + it.amount, 0),
    };
  }, [activePlan, plus.paydayDone, paydayDate]);

  const runItem = (plan: PaydayPlan, it: PaydayItem) => {
    const key = paydayDoneKey(plan.id, it.id, paydayDate);
    const existing = plus.paydayDone[key];

    if (existing) {
      if (existing.startsWith('tx_')) {
        if (!confirm(`Bỏ tick "${it.label}" và xoá giao dịch chi đã ghi?`)) return;
        deleteTransaction(existing);
      } else if (
        !confirm(
          `Bỏ tick "${it.label}"?\nGiao dịch chuyển tiền/thanh toán đã tạo vẫn được giữ nguyên trong sổ — hãy xoá thủ công nếu cần.`
        )
      ) {
        return;
      }
      updatePlus(prev => {
        const next = { ...prev.paydayDone };
        delete next[key];
        return { paydayDone: next };
      });
      return;
    }

    if (it.amount <= 0) {
      showToast('warning', 'Chưa có số tiền', 'Bấm "Sửa kịch bản" để nhập số tiền cho khoản này.');
      return;
    }
    const fromOk = data.accts.some(a => a.id === it.fromAccountId);
    let marker = 'done';

    switch (it.kind) {
      case 'transfer': {
        const toOk = data.accts.some(a => a.id === it.toAccountId);
        if (!fromOk || !toOk || it.fromAccountId === it.toAccountId) {
          showToast('warning', 'Thiếu ví chuyển', 'Chọn ví nguồn và ví đích khác nhau trong "Sửa kịch bản".');
          return;
        }
        transferMoney(it.fromAccountId!, it.toAccountId!, it.amount, `${plan.name}: ${it.label}`);
        break;
      }
      case 'expense': {
        if (!fromOk) {
          showToast('warning', 'Thiếu ví thanh toán', 'Chọn ví trả tiền trong "Sửa kịch bản".');
          return;
        }
        const tx = addTransaction({
          type: 'out',
          cat: it.cat || 'khac',
          amount: it.amount,
          date: todayStr,
          note: `${plan.name}: ${it.label}`,
          accountId: it.fromAccountId,
        });
        marker = tx.id;
        break;
      }
      case 'card': {
        if (!fromOk || !data.cards.some(c => c.id === it.cardId)) {
          showToast('warning', 'Thiếu thẻ hoặc ví', 'Chọn thẻ cần trả và ví trả tiền trong "Sửa kịch bản".');
          return;
        }
        payCreditCard(it.cardId!, it.fromAccountId!, it.amount, `${plan.name}: ${it.label}`);
        break;
      }
      case 'goal': {
        if (!data.goals.some(g => g.id === it.goalId)) {
          showToast('warning', 'Chưa chọn Quỹ mục tiêu', 'Tạo quỹ ở tab Tài sản → Quỹ mục tiêu rồi chọn trong "Sửa kịch bản".');
          return;
        }
        contributeGoal(it.goalId!, it.amount, fromOk ? it.fromAccountId : undefined);
        break;
      }
    }

    updatePlus(prev => ({ paydayDone: { ...prev.paydayDone, [key]: marker } }));
    showToast('success', `Đã hoàn thành: ${it.label}`, formatVND(it.amount));
  };

  // ---------- Chỉnh sửa kịch bản ----------
  const patchPlan = (planId: string, patch: Partial<PaydayPlan>) =>
    setDraftPlans(prev => prev.map(p => (p.id === planId ? { ...p, ...patch } : p)));

  const patchItem = (planId: string, itemId: string, patch: Partial<PaydayItem>) =>
    setDraftPlans(prev =>
      prev.map(p =>
        p.id === planId ? { ...p, items: p.items.map(it => (it.id === itemId ? { ...it, ...patch } : it)) } : p
      )
    );

  const addItem = (planId: string) =>
    setDraftPlans(prev =>
      prev.map(p =>
        p.id === planId
          ? {
              ...p,
              items: [
                ...p.items,
                {
                  id: newId('it'),
                  label: 'Khoản mới',
                  amount: 0,
                  kind: 'expense',
                  cat: 'khac',
                  fromAccountId: data.accts.find(a => a.type === 'bank')?.id || data.accts[0]?.id,
                },
              ],
            }
          : p
      )
    );

  const removeItem = (planId: string, itemId: string) =>
    setDraftPlans(prev => prev.map(p => (p.id === planId ? { ...p, items: p.items.filter(it => it.id !== itemId) } : p)));

  const saveDraft = () => {
    updatePlus({ paydayPlans: draftPlans });
    setIsEditing(false);
    showToast('success', 'Đã lưu kịch bản chia lương');
  };

  const selectClass = inputClass + ' !min-h-[40px] !py-2 !text-xs';

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Chia tiền lương"
      subtitle="Tick từng khoản để tự động ghi giao dịch tương ứng"
      footer={
        isEditing ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftPlans(paydayPlans);
                setIsEditing(false);
              }}
              className="flex-1 min-h-[44px] rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={saveDraft}
              className="flex-[2] min-h-[44px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Check size={16} />
              <span>Lưu kịch bản</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftPlans(paydayPlans);
              setIsEditing(true);
            }}
            className="w-full min-h-[44px] rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Pencil size={15} />
            <span>Sửa kịch bản</span>
          </button>
        )
      }
    >
      {/* Chọn kỳ */}
      <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
        {plans.map(p => {
          const isActive = p.id === activePlan?.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePlanId(p.id)}
              className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="block">{p.name} (Ngày {p.day})</span>
              <span className="block text-[10px] font-semibold opacity-70">
                Gần nhất {shortDate(latestPaydayDate(p.day, todayStr))} · Kế tiếp {shortDate(nextPaydayDate(p.day, todayStr))}
              </span>
            </button>
          );
        })}
      </div>

      {activePlan && !isEditing && (
        <>
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-200">
                Lương ngày {shortDate(paydayDate)} · {progress.done}/{progress.total} khoản
              </span>
              <span className="money-mask font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatVNDShort(progress.doneAmt)} / {formatVNDShort(progress.totalAmt)}
              </span>
            </div>
            <div className="h-2 mt-2 w-full bg-white/80 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
              />
            </div>
          </div>

          {activePlan.items.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4">
              Chưa có khoản nào. Bấm "Sửa kịch bản" để thêm.
            </p>
          ) : (
            <div className="space-y-2">
              {activePlan.items.map(it => {
                const done = Boolean(plus.paydayDone[paydayDoneKey(activePlan.id, it.id, paydayDate)]);
                const Icon = KIND_META[it.kind].icon;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => runItem(activePlan, it)}
                    className={`w-full min-h-[60px] text-left p-3 rounded-2xl border flex items-center gap-3 transition-all active:scale-[0.99] cursor-pointer ${
                      done
                        ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                        done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {done && <Check size={16} strokeWidth={3} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-bold truncate ${
                          done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {it.label}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                        <Icon size={11} className="shrink-0" />
                        <span className="truncate">{describeItem(it)}</span>
                      </p>
                    </div>
                    <span
                      className={`money-mask text-sm font-extrabold tabular-nums shrink-0 ${
                        done ? 'text-slate-400' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {formatVNDShort(it.amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {activePlan && isEditing && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Tên kỳ</label>
              <input
                className={inputClass}
                value={activePlan.name}
                onChange={e => patchPlan(activePlan.id, { name: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Ngày nhận lương</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                className={inputClass}
                value={activePlan.day}
                onChange={e =>
                  patchPlan(activePlan.id, { day: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })
                }
              />
            </div>
          </div>

          {activePlan.items.map(it => (
            <div
              key={it.id}
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2"
            >
              <div className="flex gap-2">
                <input
                  className={inputClass + ' flex-1'}
                  value={it.label}
                  placeholder="Tên khoản"
                  onChange={e => patchItem(activePlan.id, it.id, { label: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeItem(activePlan.id, it.id)}
                  className="w-11 min-h-[42px] rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center shrink-0 cursor-pointer"
                  aria-label="Xoá khoản"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  placeholder="Số tiền"
                  value={it.amount ? formatCurrencyInput(it.amount) : ''}
                  onChange={e => patchItem(activePlan.id, it.id, { amount: parseCurrencyInput(e.target.value) })}
                />
                <select
                  className={selectClass}
                  value={it.kind}
                  onChange={e => patchItem(activePlan.id, it.id, { kind: e.target.value as PaydayItemKind })}
                >
                  {(Object.keys(KIND_META) as PaydayItemKind[]).map(k => (
                    <option key={k} value={k}>
                      {KIND_META[k].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className={selectClass}
                  value={it.fromAccountId || ''}
                  onChange={e => patchItem(activePlan.id, it.id, { fromAccountId: e.target.value || undefined })}
                >
                  <option value="">{it.kind === 'goal' ? 'Không trừ ví' : '— Từ ví —'}</option>
                  {data.accts.map(a => (
                    <option key={a.id} value={a.id}>
                      Từ: {a.name}
                    </option>
                  ))}
                </select>

                {it.kind === 'transfer' && (
                  <select
                    className={selectClass}
                    value={it.toAccountId || ''}
                    onChange={e => patchItem(activePlan.id, it.id, { toAccountId: e.target.value || undefined })}
                  >
                    <option value="">— Đến ví —</option>
                    {data.accts.map(a => (
                      <option key={a.id} value={a.id}>
                        Đến: {a.name}
                      </option>
                    ))}
                  </select>
                )}
                {it.kind === 'expense' && (
                  <select
                    className={selectClass}
                    value={it.cat || 'khac'}
                    onChange={e => patchItem(activePlan.id, it.id, { cat: e.target.value })}
                  >
                    {allExpenseCategories.map(c => (
                      <option key={c.key} value={c.key}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                {it.kind === 'card' && (
                  <select
                    className={selectClass}
                    value={it.cardId || ''}
                    onChange={e => patchItem(activePlan.id, it.id, { cardId: e.target.value || undefined })}
                  >
                    <option value="">— Chọn thẻ —</option>
                    {data.cards.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                {it.kind === 'goal' && (
                  <select
                    className={selectClass}
                    value={it.goalId || ''}
                    onChange={e => patchItem(activePlan.id, it.id, { goalId: e.target.value || undefined })}
                  >
                    <option value="">— Chọn quỹ —</option>
                    {data.goals.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-[10px] text-slate-400">{KIND_META[it.kind].hint}</p>
            </div>
          ))}

          <button
            type="button"
            onClick={() => addItem(activePlan.id)}
            className="w-full min-h-[44px] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold flex items-center justify-center gap-1.5 hover:border-emerald-400 cursor-pointer"
          >
            <Plus size={16} />
            <span>Thêm khoản trích</span>
          </button>
        </div>
      )}
    </BottomSheet>
  );
};
