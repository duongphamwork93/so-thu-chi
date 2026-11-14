import React, { useState } from 'react';
import { X, Check, Sparkles, Plus } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { TransactionType } from '../../types/finance';
import { CategoryIcon, AVAILABLE_CATEGORY_ICONS } from '../CategoryIcon';
import confetti from 'canvas-confetti';

export const PRESET_CATEGORY_COLORS = [
  '#EA580C', // Cam (Ăn uống)
  '#D97706', // Vàng hổ phách
  '#16A34A', // Xanh lá
  '#059669', // Xanh ngọc lục bảo
  '#0D9488', // Xanh mòng két
  '#2563EB', // Xanh dương
  '#4F46E5', // Chàm indigo
  '#9333EA', // Tím violet
  '#DB2777', // Hồng cánh sen
  '#E11D48', // Hồng đỏ
  '#DC2626', // Đỏ
  '#64748B', // Xám slate
];

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: TransactionType;
  onCreated?: (catKey: string) => void;
}

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  isOpen,
  onClose,
  initialType = 'out',
  onCreated,
}) => {
  const { addCustomCategory } = useFinance();

  const [type, setType] = useState<TransactionType>(initialType);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(type === 'out' ? 'Utensils' : 'Briefcase');
  const [selectedColor, setSelectedColor] = useState(type === 'out' ? '#EA580C' : '#16A34A');
  const [section, setSection] = useState(type === 'out' ? 'Sinh hoạt' : 'Thu nhập');
  const [iconGroupFilter, setIconGroupFilter] = useState<'all' | 'food' | 'shopping' | 'travel' | 'living' | 'leisure' | 'finance'>('all');

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!shortName || shortName === name.slice(0, 10)) {
      setShortName(val.slice(0, 12));
    }
  };

  const filteredIcons = iconGroupFilter === 'all'
    ? AVAILABLE_CATEGORY_ICONS
    : AVAILABLE_CATEGORY_ICONS.filter(i => i.group === iconGroupFilter);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalShortName = (shortName.trim() || name.trim()).slice(0, 15);
    const newCat = addCustomCategory({
      name: name.trim(),
      shortName: finalShortName,
      color: selectedColor,
      type,
      group: type === 'in' ? 'income' : 'need',
      section,
      iconName: selectedIcon,
    });

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    if (onCreated) {
      onCreated(newCat.key);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Plus size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Thêm Loại Giao Dịch Mới
              </h2>
              <p className="text-[11px] text-slate-400">
                Tùy biến danh mục chi tiêu theo nhu cầu gia đình bạn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-4">
          {/* 1. Transaction Type Toggle */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setType('out');
                if (selectedColor === '#16A34A') setSelectedColor('#EA580C');
                if (selectedIcon === 'Briefcase') setSelectedIcon('Utensils');
                if (section === 'Thu nhập') setSection('Sinh hoạt');
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                type === 'out'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Loại Chi Tiêu (Tiền Ra)
            </button>
            <button
              type="button"
              onClick={() => {
                setType('in');
                if (selectedColor === '#EA580C') setSelectedColor('#16A34A');
                if (selectedIcon === 'Utensils') setSelectedIcon('Briefcase');
                setSection('Thu nhập');
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                type === 'in'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Loại Thu Nhập (Tiền Vào)
            </button>
          </div>

          {/* Live Preview Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
            <CategoryIcon
              iconName={selectedIcon}
              color={selectedColor}
              name={name || 'Tên loại mới'}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">
                Xem trước hiển thị:
              </span>
              <p className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                {name || 'VD: Tiền ăn trưa cho tôi'}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>Nhãn: <strong className="text-slate-700 dark:text-slate-300">{shortName || name || 'Ăn trưa'}</strong></span>
                <span>·</span>
                <span>Nhóm: <strong className="text-slate-700 dark:text-slate-300">{section}</strong></span>
              </div>
            </div>
          </div>

          {/* 2. Category Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Tên loại giao dịch *</span>
              <span className="text-[11px] text-slate-400 font-normal">Tối đa 30 ký tự</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="VD: Tiền ăn trưa cho tôi, Tiền ăn ngoài, Cà phê bạn bè..."
              maxLength={30}
              autoFocus
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Quick preset chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Mẫu hạng mục chi tiết (chạm để điền nhanh):
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              {[
                { n: 'Ăn sáng', sn: 'Ăn sáng', i: 'Utensils', c: '#EA580C', s: 'Sinh hoạt', t: 'out' },
                { n: 'Ăn trưa', sn: 'Ăn trưa', i: 'Utensils', c: '#EA580C', s: 'Sinh hoạt', t: 'out' },
                { n: 'Ăn tối', sn: 'Ăn tối', i: 'Pizza', c: '#D97706', s: 'Sinh hoạt', t: 'out' },
                { n: 'Cà phê & Gặp bạn', sn: 'Cà phê', i: 'Coffee', c: '#854D0E', s: 'Cá nhân', t: 'out' },
                { n: 'Xăng xe', sn: 'Xăng xe', i: 'Fuel', c: '#2563EB', s: 'Sinh hoạt', t: 'out' },
                { n: 'Gửi xe / Cầu đường', sn: 'Gửi xe', i: 'Car', c: '#2563EB', s: 'Sinh hoạt', t: 'out' },
                { n: 'Sửa chữa, rửa xe', sn: 'Sửa xe', i: 'Bike', c: '#4F46E5', s: 'Sinh hoạt', t: 'out' },
                { n: 'Tiền điện', sn: 'Tiền điện', i: 'Zap', c: '#D97706', s: 'Sinh hoạt', t: 'out' },
                { n: 'Tiền nước', sn: 'Tiền nước', i: 'Droplets', c: '#0891B2', s: 'Sinh hoạt', t: 'out' },
                { n: 'Internet & Wifi', sn: 'Internet', i: 'Smartphone', c: '#4F46E5', s: 'Sinh hoạt', t: 'out' },
                { n: 'Tiền gas', sn: 'Tiền gas', i: 'Home', c: '#DC2626', s: 'Sinh hoạt', t: 'out' },
                { n: 'Quần áo', sn: 'Quần áo', i: 'ShoppingBag', c: '#DB2777', s: 'Cá nhân', t: 'out' },
                { n: 'Giầy dép & Phụ kiện', sn: 'Giầy dép', i: 'Sparkles', c: '#9333EA', s: 'Cá nhân', t: 'out' },
                { n: 'Thuốc men', sn: 'Thuốc men', i: 'Pill', c: '#0D9488', s: 'Cá nhân', t: 'out' },
                { n: 'Cưới xin', sn: 'Cưới xin', i: 'Gift', c: '#E11D48', s: 'Tài chính và khác', t: 'out' },
                { n: 'Du lịch', sn: 'Du lịch', i: 'Plane', c: '#059669', s: 'Cá nhân', t: 'out' },
                { n: 'Tiền học thêm con', sn: 'Học thêm', i: 'GraduationCap', c: '#16A34A', s: 'Con nhỏ', t: 'out' },
                { n: 'Phí chuyển khoản / Ngân hàng', sn: 'Phí NH', i: 'CreditCard', c: '#64748B', s: 'Tài chính và khác', t: 'out' },
                { n: 'Tiền thưởng dự án', sn: 'Thưởng DA', i: 'Award', c: '#059669', s: 'Thu nhập', t: 'in' },
                { n: 'Bán hàng online', sn: 'Bán hàng', i: 'Store', c: '#2563EB', s: 'Kinh doanh', t: 'in' },
                { n: 'Cho thuê tài sản', sn: 'Cho thuê', i: 'Key', c: '#0D9488', s: 'Đầu tư', t: 'in' },
                { n: 'Lãi ngân hàng / Cổ tức', sn: 'Lãi NH', i: 'TrendingUp', c: '#16A34A', s: 'Đầu tư', t: 'in' },
              ]
                .filter(p => p.t === type)
                .map(item => (
                  <button
                    key={item.n}
                    type="button"
                    onClick={() => {
                      setName(item.n);
                      setShortName(item.sn);
                      setSelectedIcon(item.i);
                      setSelectedColor(item.c);
                      setSection(item.s);
                    }}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-white hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
                  >
                    + {item.n}
                  </button>
                ))}
            </div>
          </div>

          {/* 3. Section / Group Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Nhóm chi tiêu
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(type === 'out'
                ? ['Sinh hoạt', 'Cá nhân', 'Con nhỏ', 'Tài chính và khác']
                : ['Thu nhập', 'Kinh doanh', 'Đầu tư', 'Khác']
              ).map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSection(sec)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center truncate ${
                    section === sec
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Color Palette */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Màu đại diện
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_CATEGORY_COLORS.map(c => {
                const isSelected = selectedColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                      isSelected ? 'scale-125 ring-2 ring-offset-2 ring-emerald-500' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {isSelected && <Check size={14} className="text-white drop-shadow-xs" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Icon Selector Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Chọn biểu tượng
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {AVAILABLE_CATEGORY_ICONS.find(i => i.name === selectedIcon)?.label || selectedIcon}
              </span>
            </div>

            {/* Filter Tabs for Icons */}
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px]">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'food', label: 'Ẩm thực' },
                { id: 'shopping', label: 'Mua sắm' },
                { id: 'travel', label: 'Đi lại' },
                { id: 'living', label: 'Gia đình' },
                { id: 'leisure', label: 'Giải trí' },
                { id: 'finance', label: 'Tiền bạc' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setIconGroupFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    iconGroupFilter === f.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Icon grid */}
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 max-h-44 overflow-y-auto">
              {filteredIcons.map(iconOpt => {
                const isSelected = selectedIcon === iconOpt.name;
                return (
                  <button
                    key={iconOpt.name}
                    type="button"
                    onClick={() => setSelectedIcon(iconOpt.name)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                      isSelected
                        ? 'ring-2 ring-emerald-500 bg-white dark:bg-slate-700 scale-105 shadow-sm'
                        : 'hover:bg-slate-200/60 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300'
                    }`}
                    title={iconOpt.label}
                  >
                    <CategoryIcon
                      iconName={iconOpt.name}
                      color={isSelected ? selectedColor : '#64748B'}
                      size="sm"
                      showBackground={false}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check size={18} strokeWidth={2.4} />
              <span>Tạo Loại Giao Dịch Mới</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
