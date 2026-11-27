import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Settings2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { computeIncomeBuffer, defaultBufferAccountId, estimateDailyEssential } from '../../utils/incomeBuffer';
import { formatVND, getTodayDateString } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { BottomSheet, inputClass, labelClass } from '../ui/BottomSheet';

const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

interface IncomeBufferCardProps {
  onOpenRecurring?: () => void;
}

/** Thẻ "Vùng đệm an toàn chờ thu nhập giữa tháng" trên trang Tổng quan. */
export const IncomeBufferCard: React.FC<IncomeBufferCardProps> = ({ onOpenRecurring }) => {
  const { data, categoryMap } = useFinance();
  const { plus, updatePlus } = usePlus();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const todayStr = getTodayDateString();

  const st = useMemo(
    () => computeIncomeBuffer({ data, plus, categoryMap, todayStr }),
    [data, plus, categoryMap, todayStr]
  );

  if (!st.active) return null;
  const ok = st.shortfall === 0;

  return (
    <div
      className={`rounded-3xl p-4 sm:p-5 border shadow-sm space-y-3 ${
        ok
          ? 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
          : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {ok ? (
            <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Vùng Đệm Chờ Lương Giữa Tháng
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Thu nhập giữa tháng về khoảng {dm(st.midIncomeFrom)}–{dm(st.bufferEnd)} · cần đủ tiền đến hết{' '}
              <strong>{dm(st.bufferEnd)}</strong> ({st.days} ngày nữa)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
          aria-label="Thiết lập vùng đệm"
        >
          <Settings2 size={17} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60">
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Đang có trong {st.accountName}</span>
          <span className="money-mask text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
            {formatVND(st.accountBalance)}
          </span>
        </div>
        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60">
          <span className="text-[11px] font-semibold text-slate-500 block">Vùng đệm cần giữ</span>
          <span className="money-mask text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
            {formatVND(st.required)}
          </span>
        </div>
      </div>

      <div
        className={`px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-start gap-1.5 ${
          ok
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
        }`}
        role={ok ? 'status' : 'alert'}
      >
        {ok ? (
          <span>
            Đủ vùng đệm — dư <span className="money-mask">{formatVND(st.surplus)}</span> có thể dùng hoặc chuyển vào quỹ.
          </span>
        ) : (
          <span>
            Thiếu <span className="money-mask">{formatVND(st.shortfall)}</span> vùng đệm! Nếu thu nhập giữa tháng về chậm đến{' '}
            {dm(st.bufferEnd)}, {st.accountName} sẽ không đủ chi. Hạn chế chi / chuyển thêm tiền vào ví này ngay.
          </span>
        )}
      </div>

      <ul className="text-xs space-y-1">
        {[...st.cardItems, ...st.fixedItems]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((it, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="text-slate-600 dark:text-slate-300 min-w-0">
                {it.kind === 'card' ? '💳' : '📌'} {it.label} <span className="text-slate-400">· {dm(it.date)}</span>
              </span>
              <span className="money-mask tabular-nums font-semibold text-slate-800 dark:text-slate-100 shrink-0">
                {formatVND(it.amount)}
              </span>
            </li>
          ))}
        <li className="flex justify-between gap-2">
          <span className="text-slate-600 dark:text-slate-300 min-w-0">
            🛒 Sinh hoạt thiết yếu {st.days} ngày × <span className="money-mask">{formatVND(st.dailyEssential)}</span>
            {st.dailyEssentialIsAuto && <span className="text-slate-400"> (tự ước tính)</span>}
          </span>
          <span className="money-mask tabular-nums font-semibold text-slate-800 dark:text-slate-100 shrink-0">
            {formatVND(st.essentialTotal)}
          </span>
        </li>
      </ul>

      {st.fixedItems.length === 0 && onOpenRecurring && (
        <button
          type="button"
          onClick={onOpenRecurring}
          className="w-full min-h-[40px] rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <CalendarClock size={14} /> Thêm khoản cố định trước ngày {plus.buffer.midIncomeToDay} (VD: Học phí ngày 10)
        </button>
      )}

      <BufferSettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSave={patch => updatePlus({ buffer: { ...plus.buffer, ...patch } })} />
    </div>
  );
};

const BufferSettingsSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (patch: Partial<import('../../types/plus').IncomeBufferSettings>) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const { data, categoryMap } = useFinance();
  const { plus } = usePlus();
  const [accountId, setAccountId] = useState('');
  const [fromDay, setFromDay] = useState('10');
  const [toDay, setToDay] = useState('12');
  const [startDay, setStartDay] = useState('25');
  const [dailyStr, setDailyStr] = useState('');
  const auto = estimateDailyEssential(data, categoryMap, getTodayDateString(), plus.monthlyIncome);

  useEffect(() => {
    if (!isOpen) return;
    setAccountId(plus.buffer.accountId || defaultBufferAccountId(data) || '');
    setFromDay(String(plus.buffer.midIncomeFromDay));
    setToDay(String(plus.buffer.midIncomeToDay));
    setStartDay(String(plus.buffer.startDay));
    setDailyStr(plus.buffer.dailyEssential > 0 ? formatCurrencyInput(plus.buffer.dailyEssential) : '');
  }, [isOpen]);

  const save = () => {
    const f = Math.min(28, Math.max(1, Number(fromDay) || 10));
    const t = Math.min(28, Math.max(f, Number(toDay) || 12));
    onSave({
      accountId: accountId || undefined,
      midIncomeFromDay: f,
      midIncomeToDay: t,
      startDay: Math.min(31, Math.max(t + 1, Number(startDay) || 25)),
      dailyEssential: parseCurrencyInput(dailyStr),
    });
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Thiết lập vùng đệm"
      subtitle="Giữ đủ tiền đến ngày muộn nhất khoản thu giữa tháng về"
      footer={
        <button
          type="button"
          onClick={save}
          className="w-full min-h-[46px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Check size={16} /> Lưu thiết lập
        </button>
      }
    >
      <div>
        <label className={labelClass}>Ví / tài khoản giữ vùng đệm</label>
        <select className={inputClass} value={accountId} onChange={e => setAccountId(e.target.value)}>
          {data.accts.map(a => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Thu nhập giữa tháng về sớm nhất</label>
          <input className={inputClass} inputMode="numeric" value={fromDay} onChange={e => setFromDay(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>…muộn nhất (ngày)</label>
          <input className={inputClass} inputMode="numeric" value={toDay} onChange={e => setToDay(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Bắt đầu theo dõi từ ngày (quanh kỳ lương cuối tháng)</label>
        <input className={inputClass} inputMode="numeric" value={startDay} onChange={e => setStartDay(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Chi sinh hoạt thiết yếu mỗi ngày (₫)</label>
        <input
          className={inputClass}
          inputMode="numeric"
          value={dailyStr}
          onChange={e => setDailyStr(formatCurrencyInput(e.target.value))}
          placeholder={`Để trống = tự ước tính (${formatVND(auto)}/ngày)`}
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Ước tính từ chi tiêu hũ NEC 60 ngày qua (bỏ các khoản cố định &amp; khoản lớn trên 3 triệu): {formatVND(auto)}/ngày.
        </p>
      </div>
      <p className="text-[11px] text-slate-500">
        Khoản cố định (học phí, thuê bao…) lấy từ <strong>Khoản chi định kỳ</strong> đang bật, có ngày trừ trước ngày muộn nhất.
      </p>
    </BottomSheet>
  );
};
