import React, { useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, Check, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { BottomSheet, inputClass, labelClass } from '../ui/BottomSheet';
import { CategoryIcon } from '../CategoryIcon';
import { useFinance, recurringDueDate, recurringTxId } from '../../context/FinanceContext';
import { RecurringItem, TransactionType } from '../../types/finance';
import { classifyJar, JAR_META } from '../../utils/jars';
import { formatVND, getTodayDateString } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { showToast } from '../../utils/toast';

interface RecurringManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Draft {
  id?: string;
  type: TransactionType;
  name: string;
  amountStr: string;
  day: string;
  accountId: string;
  cat: string;
  active: boolean;
  postThisMonth: boolean;
}

const shortDate = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export const RecurringManagerModal: React.FC<RecurringManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    data,
    categoryMap,
    allExpenseCategories,
    allIncomeCategories,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    postRecurring,
  } = useFinance();
  const [draft, setDraft] = useState<Draft | null>(null);

  const todayStr = getTodayDateString();
  const monthKey = todayStr.slice(0, 7);
  const recordIds = useMemo(() => new Set(data.records.map(r => r.id)), [data.records]);

  const sourceName = (id?: string) =>
    data.cards.find(c => c.id === id)?.name || data.accts.find(a => a.id === id)?.name || 'Chưa chọn nguồn tiền';

  const jarLabel = (type: TransactionType, cat: string) => {
    if (type === 'in') return 'Khoản thu';
    const jar = classifyJar({ cat, note: '' }, categoryMap);
    return jar ? JAR_META[jar].code : 'Trung tính';
  };

  const recs = useMemo(
    () => [...data.recs].sort((a, b) => (a.dayOfMonth || 0) - (b.dayOfMonth || 0)),
    [data.recs]
  );
  const activeTotal = recs
    .filter(r => r.autoRecord !== false && r.type === 'out')
    .reduce((s, r) => s + (r.amount || 0), 0);

  const statusOf = (rec: RecurringItem) => {
    const due = recurringDueDate(rec.dayOfMonth, monthKey);
    if (recordIds.has(recurringTxId(rec.id, monthKey))) return { tone: 'done', text: `Đã ghi sổ tháng này` };
    if (rec.autoRecord === false) return { tone: 'paused', text: 'Đang tạm dừng' };
    if ((rec.lastRecorded || '').slice(0, 7) >= monthKey) return { tone: 'skip', text: 'Tháng này bỏ qua · tự ghi từ tháng sau' };
    if (due <= todayStr) return { tone: 'pending', text: 'Đến hạn — sẽ tự ghi' };
    return { tone: 'wait', text: `Sẽ tự ghi ngày ${shortDate(due)}` };
  };

  const openNew = () =>
    setDraft({
      type: 'out',
      name: '',
      amountStr: '',
      day: String(new Date().getDate()),
      accountId: data.settings.defaultPaymentAccountId || data.cards[0]?.id || data.accts[0]?.id || '',
      cat: 'giai_tri',
      active: true,
      postThisMonth: false,
    });

  const openEdit = (rec: RecurringItem) =>
    setDraft({
      id: rec.id,
      type: rec.type,
      name: rec.name,
      amountStr: formatCurrencyInput(rec.amount),
      day: String(rec.dayOfMonth),
      accountId: rec.accountId || '',
      cat: rec.cat,
      active: rec.autoRecord !== false,
      postThisMonth: false,
    });

  const saveDraft = () => {
    if (!draft) return;
    const amount = parseCurrencyInput(draft.amountStr);
    const day = Math.min(31, Math.max(1, Number(draft.day) || 1));
    if (!draft.name.trim() || amount <= 0) {
      showToast('warning', 'Thiếu thông tin', 'Nhập tên khoản và số tiền lớn hơn 0.');
      return;
    }
    const payload = {
      type: draft.type,
      name: draft.name.trim(),
      amount,
      cat: draft.cat,
      cycle: 'monthly' as const,
      dayOfMonth: day,
      accountId: draft.accountId || undefined,
      autoRecord: draft.active,
    };
    const dueThisMonth = recurringDueDate(day, monthKey) <= todayStr;

    if (draft.id) {
      updateRecurring(draft.id, payload);
      showToast('success', `Đã lưu "${payload.name}"`);
    } else {
      addRecurring({
        ...payload,
        // Ngày trừ tháng này đã qua mà không chọn "ghi luôn" → bắt đầu tự ghi từ tháng sau
        lastRecorded: dueThisMonth && !draft.postThisMonth ? monthKey : undefined,
      });
      showToast(
        'success',
        `Đã thêm "${payload.name}"`,
        dueThisMonth && !draft.postThisMonth
          ? 'Sẽ tự ghi sổ từ tháng sau.'
          : `Sẽ tự ghi sổ ngày ${day} hằng tháng.`
      );
      if (dueThisMonth && draft.postThisMonth) {
        // Khoản mới cần có trong dữ liệu trước khi ghi → để bộ tự động chạy ở lần kiểm tra kế tiếp
        setTimeout(() => postRecurring(), 300);
      }
    }
    setDraft(null);
  };

  const postNow = (rec: RecurringItem) => {
    const posted = postRecurring({ recIds: [rec.id], force: true });
    if (posted.length > 0) showToast('success', `Đã ghi sổ: ${rec.name} ${formatVND(rec.amount)}`, `Vào ${sourceName(rec.accountId)}`);
    else showToast('info', 'Tháng này đã có giao dịch của khoản này');
  };

  const cats = draft?.type === 'in' ? allIncomeCategories : allExpenseCategories;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        setDraft(null);
        onClose();
      }}
      title={
        <span className="flex items-center gap-2">
          {draft && (
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Quay lại danh sách"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <CalendarClock size={18} className="text-emerald-600" />
          {draft ? (draft.id ? 'Sửa khoản định kỳ' : 'Thêm khoản định kỳ') : 'Khoản định kỳ hằng tháng'}
        </span>
      }
      subtitle={
        draft
          ? 'Tự ghi sổ vào đúng ngày, đúng thẻ/ví và đúng hũ'
          : `${recs.length} khoản · Tổng chi đang bật: ${formatVND(activeTotal)}/tháng`
      }
      footer={
        draft ? (
          <button
            type="button"
            onClick={saveDraft}
            className="w-full min-h-[46px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Check size={16} />
            Lưu khoản định kỳ
          </button>
        ) : (
          <button
            type="button"
            onClick={openNew}
            className="w-full min-h-[46px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={16} />
            Thêm khoản định kỳ
          </button>
        )
      }
    >
      {!draft && (
        <>
          {recs.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">
              Chưa có khoản nào. Thêm các thuê bao như Claude, YouTube, điện, nước, học phí… để app tự ghi sổ mỗi tháng.
            </p>
          )}
          <div className="space-y-2">
            {recs.map(rec => {
              const st = statusOf(rec);
              const active = rec.autoRecord !== false;
              const canPostNow = st.tone !== 'done';
              return (
                <div
                  key={rec.id}
                  className={`p-3 rounded-2xl border space-y-2 ${
                    active
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 opacity-80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon catKey={rec.cat} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{rec.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        Ngày {rec.dayOfMonth} · {sourceName(rec.accountId)} · {categoryMap[rec.cat]?.shortName || rec.cat} ·{' '}
                        <strong>{jarLabel(rec.type, rec.cat)}</strong>
                      </p>
                    </div>
                    <span
                      className={`money-mask text-sm font-extrabold tabular-nums shrink-0 ${
                        rec.type === 'in' ? 'text-green-600' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {rec.type === 'in' ? '+' : ''}
                      {formatVND(rec.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        st.tone === 'done'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : st.tone === 'pending'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {st.text}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {canPostNow && (
                        <button
                          type="button"
                          onClick={() => postNow(rec)}
                          className="min-h-[36px] px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          title="Ghi sổ ngay cho tháng này"
                        >
                          <Zap size={13} />
                          Ghi ngay
                        </button>
                      )}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        aria-label={active ? 'Tạm dừng' : 'Bật lại'}
                        onClick={() => {
                          updateRecurring(rec.id, { autoRecord: !active });
                          showToast('info', active ? `Đã tạm dừng "${rec.name}"` : `Đã bật lại "${rec.name}"`);
                        }}
                        className={`relative w-11 h-7 rounded-full transition-colors cursor-pointer ${
                          active ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                            active ? 'left-5' : 'left-1'
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(rec)}
                        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                        aria-label="Sửa"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Xoá khoản định kỳ "${rec.name}"?\nCác giao dịch đã ghi trước đây vẫn được giữ nguyên.`)) {
                            deleteRecurring(rec.id);
                          }
                        }}
                        className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center cursor-pointer"
                        aria-label="Xoá"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {draft && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
            {(['out', 'in'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setDraft({ ...draft, type: t, cat: t === 'in' ? 'luong' : 'giai_tri' })}
                className={`min-h-[40px] rounded-xl text-xs font-bold cursor-pointer ${
                  draft.type === t ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                {t === 'out' ? 'Khoản chi' : 'Khoản thu'}
              </button>
            ))}
          </div>

          <div>
            <label className={labelClass}>Tên khoản / Ghi chú</label>
            <input
              className={inputClass}
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="VD: Gia hạn Claude Pro"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Số tiền mặc định (₫)</label>
              <input
                className={inputClass}
                inputMode="numeric"
                value={draft.amountStr}
                onChange={e => setDraft({ ...draft, amountStr: formatCurrencyInput(e.target.value) })}
                placeholder="600.000"
              />
            </div>
            <div>
              <label className={labelClass}>Ngày trừ tiền hằng tháng</label>
              <select className={inputClass} value={draft.day} onChange={e => setDraft({ ...draft, day: e.target.value })}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>
                    Ngày {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Nguồn tiền {draft.type === 'out' ? 'bị trừ' : 'nhận'}</label>
            <select
              className={inputClass}
              value={draft.accountId}
              onChange={e => setDraft({ ...draft, accountId: e.target.value })}
            >
              {draft.type === 'out' && data.cards.length > 0 && (
                <optgroup label="Thẻ tín dụng">
                  {data.cards.map(c => (
                    <option key={c.id} value={c.id}>
                      💳 {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Ví & Tài khoản">
                {data.accts.map(a => (
                  <option key={a.id} value={a.id}>
                    🏦 {a.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className={labelClass}>Hạng mục</label>
            <select className={inputClass} value={draft.cat} onChange={e => setDraft({ ...draft, cat: e.target.value })}>
              {cats.map(c => (
                <option key={c.key} value={c.key}>
                  {c.name}
                  {draft.type === 'out' ? ` — ${jarLabel('out', c.key)}` : ''}
                </option>
              ))}
            </select>
            {draft.type === 'out' && (
              <p className="text-[11px] text-slate-500 mt-1">
                Tính vào hũ: <strong>{jarLabel('out', draft.cat)}</strong>
              </p>
            )}
          </div>

          <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tự động ghi sổ hằng tháng</span>
            <input
              type="checkbox"
              className="w-5 h-5 accent-emerald-600"
              checked={draft.active}
              onChange={e => setDraft({ ...draft, active: e.target.checked })}
            />
          </label>

          {!draft.id && recurringDueDate(Number(draft.day) || 1, monthKey) <= todayStr && (
            <label className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 cursor-pointer">
              <span className="text-xs text-amber-900 dark:text-amber-200">
                Ngày {draft.day} tháng này đã qua. Ghi luôn khoản này cho tháng này?
                <br />
                <span className="opacity-80">Bỏ chọn nếu bạn đã tự ghi tay rồi — app sẽ bắt đầu từ tháng sau.</span>
              </span>
              <input
                type="checkbox"
                className="w-5 h-5 mt-0.5 accent-emerald-600 shrink-0"
                checked={draft.postThisMonth}
                onChange={e => setDraft({ ...draft, postThisMonth: e.target.checked })}
              />
            </label>
          )}
        </div>
      )}
    </BottomSheet>
  );
};
