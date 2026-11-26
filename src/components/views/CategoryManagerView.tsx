import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import {
  CategoryInfo,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  LEGACY_CATEGORIES,
  MERGED_LEGACY_KEYS,
  canonicalCategoryKey,
  sectionRank,
} from '../../constants/categories';
import { CategoryIcon } from '../CategoryIcon';
import { AddCategoryModal, JAR_CHOICES } from '../modals/AddCategoryModal';
import { classifyJar } from '../../utils/jars';
import { TransactionType } from '../../types/finance';
import { showToast } from '../../utils/toast';



interface Row {
  info: CategoryInfo;
  isCustom: boolean;
  hidden: boolean;
  usedCount: number;
}

export const CategoryManagerView: React.FC = () => {
  const { data, categoryMap, customCategories, deleteCustomCategory } = useFinance();
  const { plus, updatePlus } = usePlus();
  const [tab, setTab] = useState<TransactionType>('out');
  const [modal, setModal] = useState<{ editKey: string | null } | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const usage = useMemo(() => {
    const m: Record<string, number> = {};
    data.records.forEach(r => {
      m[r.cat] = (m[r.cat] || 0) + 1;
      const c = canonicalCategoryKey(r.cat);
      if (c !== r.cat) m[c] = (m[c] || 0) + 1;
    });
    return m;
  }, [data.records]);

  const rows = useMemo<Row[]>(() => {
    const ov = plus.categoryOverrides;
    const base =
      tab === 'out'
        ? [...EXPENSE_CATEGORIES, ...LEGACY_CATEGORIES.filter(c => !MERGED_LEGACY_KEYS.has(c.key))]
        : INCOME_CATEGORIES;
    const legacyKeys = new Set(LEGACY_CATEGORIES.map(c => c.key));
    const builtIn: Row[] = base.map(c => ({
      info: categoryMap[c.key] || c,
      isCustom: false,
      hidden: ov[c.key]?.hidden ?? legacyKeys.has(c.key),
      usedCount: usage[c.key] || 0,
    }));
    const customs: Row[] = customCategories
      .filter(c => c.type === tab)
      .map(c => ({
        info: categoryMap[c.key],
        isCustom: true,
        hidden: Boolean(ov[c.key]?.hidden),
        usedCount: usage[c.key] || 0,
      }))
      .filter(r => Boolean(r.info));
    return [...builtIn, ...customs];
  }, [tab, plus.categoryOverrides, categoryMap, customCategories, usage]);

  const visible = rows.filter(r => !r.hidden);
  const hiddenRows = rows.filter(r => r.hidden);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    visible.forEach(r => {
      const sec = r.info.section || 'Khác';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(r);
    });
    return [...map.entries()].sort((a, b) => {
      return sectionRank(a[0]) - sectionRank(b[0]);
    });
  }, [visible]);

  const jarBadge = (key: string) => {
    const j = classifyJar({ cat: key, note: '' }, categoryMap) || 'none';
    return JAR_CHOICES.find(c => c.id === j)!;
  };

  const setHidden = (key: string, hidden: boolean) =>
    updatePlus(prev => ({
      categoryOverrides: { ...prev.categoryOverrides, [key]: { ...prev.categoryOverrides[key], hidden } },
    }));

  const handleRemove = (r: Row) => {
    const label = r.info.shortName || r.info.name;
    if (!r.isCustom) {
      setHidden(r.info.key, true);
      showToast('info', `Đã ẩn "${label}"`, 'Giao dịch cũ vẫn hiển thị bình thường. Có thể hiện lại ở mục "Đã ẩn".');
      return;
    }
    if (r.usedCount > 0) {
      if (!confirm(`"${label}" đang có ${r.usedCount} giao dịch.\nDanh mục sẽ được ẨN (không xoá) để giao dịch cũ vẫn hiển thị đúng. Tiếp tục?`)) return;
      setHidden(r.info.key, true);
      showToast('info', `Đã ẩn "${label}"`);
      return;
    }
    if (!confirm(`Xoá hẳn danh mục tự tạo "${label}"?`)) return;
    deleteCustomCategory(r.info.key);
    updatePlus(prev => {
      const next = { ...prev.categoryOverrides };
      delete next[r.info.key];
      return { categoryOverrides: next };
    });
    showToast('success', `Đã xoá "${label}"`);
  };

  const renderRow = (r: Row) => {
    const badge = jarBadge(r.info.key);
    return (
      <div key={r.info.key} className="flex items-center gap-3 px-3 py-2.5">
        <CategoryIcon catKey={r.info.key} iconName={r.info.iconName} color={r.info.color} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.info.shortName}</span>
            {tab === 'out' && (
              <span
                className="px-1.5 py-0.5 rounded-md text-[10px] font-black text-white shrink-0"
                style={{ backgroundColor: badge.color }}
              >
                {badge.code}
              </span>
            )}
            {r.isCustom && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                Tự tạo
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {r.info.name !== r.info.shortName ? r.info.name : ''}
            {r.usedCount > 0 ? `${r.info.name !== r.info.shortName ? ' · ' : ''}${r.usedCount} giao dịch` : ''}
          </p>
        </div>
        {r.hidden ? (
          <button
            type="button"
            onClick={() => {
              setHidden(r.info.key, false);
              showToast('success', `Đã hiện lại "${r.info.shortName}"`);
            }}
            className="min-h-[38px] px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Eye size={14} /> Hiện lại
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setModal({ editKey: r.info.key })}
              className="min-h-[38px] px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
              aria-label={`Sửa ${r.info.shortName}`}
            >
              <Pencil size={13} /> Sửa
            </button>
            <button
              type="button"
              onClick={() => handleRemove(r)}
              className="min-h-[38px] px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 text-xs font-bold flex items-center gap-1 cursor-pointer"
              aria-label={`${r.isCustom ? 'Xoá' : 'Ẩn'} ${r.info.shortName}`}
            >
              {r.isCustom ? <Trash2 size={13} /> : <EyeOff size={13} />}
              {r.isCustom ? 'Xoá' : 'Ẩn'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-36">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
              <Tag size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">Danh Mục Thu Chi</h2>
              <p className="text-[11px] text-slate-500">{visible.length} danh mục đang dùng</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModal({ editKey: null })}
            className="min-h-[42px] px-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shrink-0 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={16} /> Thêm danh mục mới
          </button>
        </div>

        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
          {(['out', 'in'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`min-h-[42px] rounded-xl text-sm font-bold transition-all cursor-pointer ${
                tab === t ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              {t === 'out' ? 'Danh mục Chi' : 'Danh mục Thu'}
            </button>
          ))}
        </div>
      </div>

      {grouped.map(([section, list]) => (
        <div key={section} className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            {section} <span className="font-semibold text-slate-400">({list.length})</span>
          </h3>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {list.map(renderRow)}
          </div>
        </div>
      ))}

      {hiddenRows.length > 0 && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setShowHidden(v => !v)}
            className="w-full min-h-[40px] px-1 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer"
          >
            <span>Đã ẩn ({hiddenRows.length})</span>
            {showHidden ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showHidden && (
            <div className="bg-white/70 dark:bg-slate-900/70 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {hiddenRows.map(renderRow)}
            </div>
          )}
        </div>
      )}

      <AddCategoryModal
        isOpen={modal !== null}
        onClose={() => setModal(null)}
        initialType={tab}
        editKey={modal?.editKey || null}
      />
    </div>
  );
};
