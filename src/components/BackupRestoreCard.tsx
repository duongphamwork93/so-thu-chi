import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { usePlus } from '../context/PlusContext';
import { exportTransactionsCSV } from '../utils/exportData';
import { showToast } from '../utils/toast';

/** Khu "Sao lưu & Khôi phục": JSON đầy đủ (sổ chính + Sổ Plus), CSV giao dịch, khôi phục JSON. */
export const BackupRestoreCard: React.FC = () => {
  const { data, categoryMap } = useFinance();
  const { exportFullBackup, importFullBackup, isInPeriod, periodRange } = usePlus();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvScope, setCsvScope] = useState<'all' | 'period'>('all');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (
      !confirm(
        'Khôi phục sẽ THAY THẾ toàn bộ dữ liệu hiện tại bằng dữ liệu trong file.\nNên "Xuất JSON" bản hiện tại trước khi khôi phục. Tiếp tục?'
      )
    ) {
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const ok = importFullBackup(String(ev.target?.result || ''));
      if (ok) showToast('success', 'Đã khôi phục dữ liệu từ file sao lưu');
      else showToast('danger', 'File sao lưu không hợp lệ', 'Vui lòng chọn đúng file .json đã xuất từ Sổ Thu Chi.');
    };
    reader.readAsText(file);
  };

  const handleCsv = () => {
    const records = csvScope === 'all' ? data.records : data.records.filter(r => isInPeriod(r.date));
    if (records.length === 0) {
      showToast('warning', 'Không có giao dịch để xuất');
      return;
    }
    exportTransactionsCSV(data, categoryMap, records, csvScope === 'all' ? 'tat_ca' : periodRange.start.slice(0, 7));
    showToast('success', `Đã xuất ${records.length} giao dịch ra file CSV`);
  };

  const btn =
    'min-h-[56px] p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 text-left transition-colors active:scale-[0.98] cursor-pointer';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sao Lưu & Khôi Phục Dữ Liệu</h4>
        <p className="text-[11px] text-slate-400 mt-0.5">
          File JSON chứa toàn bộ sổ (kể cả kịch bản chia lương, hạn mức thẻ, quỹ mục tiêu). CSV mở được bằng Excel / Google Sheets.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button type="button" onClick={exportFullBackup} className={btn}>
          <span className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
            <Download size={18} />
          </span>
          <span>
            <span className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Xuất dữ liệu (JSON)</span>
            <span className="block text-[11px] text-slate-400">Bản sao lưu đầy đủ</span>
          </span>
        </button>

        <div className={btn + ' !cursor-default flex-col !items-stretch !gap-2'}>
          <button type="button" onClick={handleCsv} className="flex items-center gap-3 text-left cursor-pointer">
            <span className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={18} />
            </span>
            <span>
              <span className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Xuất giao dịch (CSV)</span>
              <span className="block text-[11px] text-slate-400">
                {csvScope === 'all' ? 'Toàn bộ lịch sử' : `${periodRange.label} (${periodRange.rangeLabel})`}
              </span>
            </span>
          </button>
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-200/60 dark:bg-slate-700/60 rounded-lg">
            {(
              [
                { k: 'all', label: 'Tất cả' },
                { k: 'period', label: 'Kỳ đang xem' },
              ] as const
            ).map(o => (
              <button
                key={o.k}
                type="button"
                onClick={() => setCsvScope(o.k)}
                className={`min-h-[28px] rounded-md text-[11px] font-bold cursor-pointer ${
                  csvScope === o.k ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={() => fileRef.current?.click()} className={btn}>
          <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center shrink-0">
            <Upload size={18} />
          </span>
          <span>
            <span className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Khôi phục dữ liệu</span>
            <span className="block text-[11px] text-slate-400">Chọn file .json đã xuất</span>
          </span>
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
};
