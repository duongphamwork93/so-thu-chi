import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { CategoryInfo, removeVietnameseAccents, sectionRank } from '../constants/categories';
import { TransactionType } from '../types/finance';
import { classifyJar } from '../utils/jars';
import { CategoryIcon } from './CategoryIcon';
import { AddCategoryModal, JAR_CHOICES } from './modals/AddCategoryModal';

interface CategorySelectDropdownProps {
  value: string;
  onChange: (key: string) => void;
  type: TransactionType;
  label?: string;
  /** Hiện mục "Hay dùng" (theo tần suất trong sổ) ở đầu danh sách */
  showFrequent?: boolean;
  /** Cho phép tạo danh mục mới ngay trong danh sách */
  allowCreate?: boolean;
  className?: string;
}

const norm = (s: string) => removeVietnameseAccents(s || '').replace(/\s+/g, ' ').trim();

/**
 * Ô chọn danh mục DÙNG CHUNG cho Quét hoá đơn, Nhập tay, Chỉnh sửa giao dịch, Giọng nói.
 * Đọc từ một nguồn duy nhất (FinanceContext: mặc định + tự tạo, đã áp dụng đổi tên/hũ/ẩn).
 */
export const CategorySelectDropdown: React.FC<CategorySelectDropdownProps> = ({
  value,
  onChange,
  type,
  label,
  showFrequent = true,
  allowCreate = true,
  className = '',
}) => {
  const { data, allExpenseCategories, allIncomeCategories, categoryMap } = useFinance();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const list = type === 'out' ? allExpenseCategories : allIncomeCategories;
  const selected: CategoryInfo | undefined = categoryMap[value];

  const jarOf = (key: string) => {
    if (type === 'in') return null;
    const j = classifyJar({ cat: key, note: '' }, categoryMap) || 'none';
    return JAR_CHOICES.find(c => c.id === j) || null;
  };

  const frequent = useMemo(() => {
    if (!showFrequent) return [];
    const counts: Record<string, number> = {};
    data.records.forEach(r => {
      if (r.type === type) counts[r.cat] = (counts[r.cat] || 0) + 1;
    });
    return list
      .filter(c => counts[c.key])
      .sort((a, b) => counts[b.key] - counts[a.key])
      .slice(0, 6);
  }, [data.records, list, type, showFrequent]);

  const groups = useMemo(() => {
    const q = norm(query);
    const filtered = q
      ? list.filter(c => [c.name, c.shortName, c.section].some(t => norm(t).includes(q)))
      : list;
    const map = new Map<string, CategoryInfo[]>();
    filtered.forEach(c => {
      const sec = c.section || 'Khác';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(c);
    });
    return [...map.entries()].sort((a, b) => sectionRank(a[0]) - sectionRank(b[0]));
  }, [list, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    // Cuộn tới mục đang chọn
    setTimeout(() => {
      listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'center' });
    }, 50);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
  };

  const selJar = selected ? jarOf(selected.key) : null;

  const Row: React.FC<{ c: CategoryInfo }> = ({ c }) => {
    const jar = jarOf(c.key);
    const isSel = c.key === value;
    return (
      <button
        type="button"
        data-selected={isSel}
        onClick={() => pick(c.key)}
        className={`w-full min-h-[52px] px-3 py-2 flex items-center gap-3 text-left rounded-2xl transition-colors cursor-pointer ${
          isSel ? 'bg-emerald-50 dark:bg-emerald-950/50 ring-1 ring-emerald-500/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
        }`}
      >
        <CategoryIcon catKey={c.key} iconName={c.iconName} color={c.color} size="sm" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-slate-900 dark:text-white leading-snug break-words">{c.name}</span>
          {c.shortName && norm(c.shortName) !== norm(c.name) && (
            <span className="block text-[11px] text-slate-400 leading-tight">{c.shortName}</span>
          )}
        </span>
        {jar && (
          <span
            className="px-1.5 py-0.5 rounded-md text-[10px] font-black text-white shrink-0"
            style={{ backgroundColor: jar.color }}
          >
            {jar.code}
          </span>
        )}
        {isSel && <Check size={16} className="text-emerald-600 shrink-0" />}
      </button>
    );
  };

  return (
    <div className={className}>
      {label && <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full min-h-[52px] px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-3 text-left active:scale-[0.99] transition-all cursor-pointer"
      >
        {selected ? (
          <CategoryIcon catKey={selected.key} iconName={selected.iconName} color={selected.color} size="sm" />
        ) : (
          <span className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
            {selected?.name || 'Chọn danh mục'}
          </span>
          {selected?.section && <span className="block text-[11px] text-slate-400">{selected.section}</span>}
        </span>
        {selJar && (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black text-white shrink-0" style={{ backgroundColor: selJar.color }}>
            {selJar.code}
          </span>
        )}
        <ChevronDown size={18} className="text-slate-400 shrink-0" />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10060] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              role="listbox"
              aria-label="Chọn danh mục"
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-lg h-[88dvh] sm:h-[80vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200"
            >
              {/* Header cố định + tìm kiếm */}
              <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Chọn danh mục {type === 'out' ? 'chi' : 'thu'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Đóng"
                    className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Tìm nhanh (gõ không dấu: sua, sinh hoat…)"
                    className="w-full min-h-[44px] pl-10 pr-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Danh sách cuộn */}
              <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-4">
                {!query && frequent.length > 0 && (
                  <div>
                    <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Hay dùng</p>
                    <div className="space-y-0.5">
                      {frequent.map(c => (
                        <Row key={`f_${c.key}`} c={c} />
                      ))}
                    </div>
                  </div>
                )}
                {groups.map(([sec, items]) => (
                  <div key={sec}>
                    <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {sec} <span className="font-semibold">({items.length})</span>
                    </p>
                    <div className="space-y-0.5">
                      {items.map(c => (
                        <Row key={c.key} c={c} />
                      ))}
                    </div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-8">Không tìm thấy danh mục "{query}"</p>
                )}
              </div>

              {allowCreate && (
                <div className="shrink-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,16px))] border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setIsCreating(true);
                    }}
                    className="w-full min-h-[46px] rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={16} /> Thêm danh mục mới
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {allowCreate && (
        <AddCategoryModal
          isOpen={isCreating}
          onClose={() => setIsCreating(false)}
          initialType={type}
          onCreated={key => onChange(key)}
        />
      )}
    </div>
  );
};
