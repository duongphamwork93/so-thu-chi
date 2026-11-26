import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from 'lucide-react';
import { dismissToast, subscribeToasts, ToastItem } from '../utils/toast';

const TONE_STYLES: Record<ToastItem['tone'], { box: string; icon: React.ReactNode }> = {
  info: {
    box: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100',
    icon: <Info size={18} className="text-emerald-600 dark:text-emerald-400" />,
  },
  success: {
    box: 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100',
    icon: <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />,
  },
  warning: {
    box: 'bg-amber-50 dark:bg-amber-950/90 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100',
    icon: <AlertTriangle size={18} className="text-amber-500" />,
  },
  danger: {
    box: 'bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100',
    icon: <OctagonAlert size={18} className="text-rose-600 dark:text-rose-400" />,
  },
};

export const ToastHost: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (typeof document === 'undefined' || items.length === 0) return null;

  return createPortal(
    <div className="fixed left-0 right-0 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-[10050] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {items.map(t => {
        const style = TONE_STYLES[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === 'danger' ? 'alert' : 'status'}
            className={`pointer-events-auto w-full max-w-md rounded-2xl border shadow-lg px-3.5 py-3 flex items-start gap-2.5 animate-in fade-in slide-in-from-top duration-200 ${style.box}`}
          >
            <span className="shrink-0 mt-0.5">{style.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold leading-snug">{t.title}</p>
              {t.message && <p className="text-[11px] sm:text-xs mt-0.5 opacity-90 leading-snug">{t.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="shrink-0 w-7 h-7 -mr-1 -mt-0.5 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 cursor-pointer"
              aria-label="Đóng thông báo"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
};
