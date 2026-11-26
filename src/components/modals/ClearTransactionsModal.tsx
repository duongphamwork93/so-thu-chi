import React, { useState, useEffect } from 'react';
import { AlertTriangle, Download, Trash2, X, ShieldCheck } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface ClearTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCleared?: (deletedCount: number) => void;
}

export const ClearTransactionsModal: React.FC<ClearTransactionsModalProps> = ({
  isOpen,
  onClose,
  onCleared,
}) => {
  const { data, clearAllTransactions, exportBackupJSON } = useFinance();
  const [revertBalances, setRevertBalances] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRevertBalances(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalCount = data.records.length;

  const handleConfirm = () => {
    if (totalCount === 0) {
      onClose();
      return;
    }
    clearAllTransactions({ revertBalances });
    onCleared?.(totalCount);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 bg-rose-50/80 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900/40 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Xóa Hết Giao Dịch?
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-300 font-semibold mt-0.5">
                Hành động này không thể hoàn tác
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/80 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            Bạn sắp xóa toàn bộ{' '}
            <strong className="text-rose-600 dark:text-rose-400 font-black">
              {totalCount.toLocaleString('vi-VN')} giao dịch
            </strong>{' '}
            (tất cả khoản thu & chi của mọi tháng) khỏi ứng dụng và dữ liệu đồng bộ.
          </p>

          {/* What is kept */}
          <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <ShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              Các tài khoản ngân hàng, ví, thẻ tín dụng, sổ tiết kiệm, mục tiêu, danh mục và cài đặt của bạn <strong>vẫn được giữ nguyên</strong>.
            </span>
          </div>

          {/* Optional balance revert checkbox */}
          <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={revertBalances}
              onChange={e => setRevertBalances(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-rose-600 cursor-pointer shrink-0"
            />
            <div className="space-y-0.5">
              <span className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                Hoàn trả lại số dư ví & dư nợ thẻ
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Nếu bỏ chọn, số dư hiện tại của các ví/thẻ sẽ giữ nguyên. Nếu chọn, app sẽ tự cộng/trừ hoàn lại số tiền của các giao dịch bị xóa.
              </span>
            </div>
          </label>

          {/* Quick backup link */}
          <button
            type="button"
            onClick={exportBackupJSON}
            className="w-full min-h-[42px] px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download size={15} />
            <span>Tải file sao lưu (.json) trước khi xóa</span>
          </button>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-sm shadow-rose-500/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 size={16} />
              <span>Xóa hết ({totalCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
