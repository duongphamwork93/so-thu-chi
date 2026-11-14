import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Upload,
  Target,
  Shield,
  CheckCircle2,
  BookOpen,
  ShieldCheck,
  Tag,
  Plus,
  Trash2,
  Users,
  Github,
  Rocket,
  Cloud,
  RefreshCw,
  LogOut,
  Smartphone,
  CreditCard,
  Sparkles,
  Star,
  Palette,
  Sun,
  Moon,
  Monitor,
  Check,
  Image as ImageIcon,
  Share,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { formatVND, parseVietnameseMoneyText } from '../../utils/formatters';
import { getPaymentTargetLabel } from '../../utils/paymentMatcher';
import { COLOR_THEMES, ColorThemeId, getColorThemeOption } from '../../constants/themes';
import { CategoryIcon } from '../CategoryIcon';
import { AddCategoryModal } from '../modals/AddCategoryModal';

interface SettingsViewProps {
  onOpenGitHubModal?: () => void;
  onOpenAccountSync?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenGitHubModal,
  onOpenAccountSync,
}) => {
  const {
    data,
    updateSettings,
    togglePrivacyMask,
    exportBackupJSON,
    importBackupJSON,
    customCategories,
    deleteCustomCategory,
    syncStatus,
    forceUploadAllToCloud,
  } = useFinance();
  const { user, signInWithGoogle, signOutUser, authLoading } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ledgerNameInput, setLedgerNameInput] = useState<string>(
    data.settings.ledgerName || 'Sổ Thu Chi'
  );
  const [child1Name, setChild1Name] = useState<string>(data.settings.memberNames?.child1 || 'Con 1');
  const [child2Name, setChild2Name] = useState<string>(data.settings.memberNames?.child2 || 'Con 2');
  const [meName, setMeName] = useState<string>(data.settings.memberNames?.me || 'Bản thân tôi');
  const [spouseName, setSpouseName] = useState<string>(data.settings.memberNames?.spouse || 'Chồng');

  const [budgetInput, setBudgetInput] = useState<string>(
    data.settings.budget ? String(data.settings.budget) : ''
  );
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [canInstallPWA, setCanInstallPWA] = useState<boolean>(
    () => typeof window !== 'undefined' && Boolean(window.__pwaInstallPrompt)
  );
  const [isStandaloneApp, setIsStandaloneApp] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
    );
  });

  useEffect(() => {
    const syncInstallState = () => {
      setCanInstallPWA(Boolean(window.__pwaInstallPrompt));
      setIsStandaloneApp(
        window.matchMedia('(display-mode: standalone)').matches ||
          Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
      );
    };
    window.addEventListener('pwa-install-available', syncInstallState);
    return () => window.removeEventListener('pwa-install-available', syncInstallState);
  }, []);

  const handleInstallPWA = async () => {
    const promptEvent = window.__pwaInstallPrompt;
    if (!promptEvent) return;
    await promptEvent.prompt();
    const result = await promptEvent.userChoice;
    if (result.outcome === 'accepted') {
      window.__pwaInstallPrompt = null;
      setCanInstallPWA(false);
      setActionNotice('Đã gửi yêu cầu cài đặt Sổ Thu Chi với biểu tượng mới ra màn hình chính!');
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Default payment & keyword rules form state
  const [ruleKeyword, setRuleKeyword] = useState<string>('');
  const [ruleTargetId, setRuleTargetId] = useState<string>(
    data.settings.defaultPaymentAccountId || data.cards?.[0]?.id || data.accts?.[0]?.id || ''
  );

  // Add custom family member form state
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberAvatar, setNewMemberAvatar] = useState<string>('👵');

  // Sync form inputs when cloud settings update from another device
  useEffect(() => {
    setLedgerNameInput(data.settings.ledgerName || 'Sổ Thu Chi');
    setBudgetInput(data.settings.budget ? String(data.settings.budget) : '');
    setChild1Name(data.settings.memberNames?.child1 || 'Con 1');
    setChild2Name(data.settings.memberNames?.child2 || 'Con 2');
    setMeName(data.settings.memberNames?.me || 'Bản thân tôi');
    setSpouseName(data.settings.memberNames?.spouse || 'Chồng');
    if (data.settings.defaultPaymentAccountId) {
      setRuleTargetId(prev => prev || data.settings.defaultPaymentAccountId || '');
    }
  }, [data.settings]);

  const handleSelectDefaultPaymentAccount = (accountId: string) => {
    updateSettings({ defaultPaymentAccountId: accountId });
    if (accountId) {
      setRuleTargetId(accountId);
      const label = getPaymentTargetLabel(accountId, data);
      setActionNotice(`Đã đặt "${label}" làm thẻ / ví thanh toán chính mặc định!`);
    } else {
      setActionNotice('Đã bỏ đặt thẻ thanh toán chính mặc định.');
    }
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleAddAutoPaymentRule = (keywordToAdd?: string) => {
    const cleanKw = (keywordToAdd ?? ruleKeyword).trim().slice(0, 80);
    const targetId = ruleTargetId || data.settings.defaultPaymentAccountId || data.cards?.[0]?.id || data.accts?.[0]?.id || '';
    if (!cleanKw || !targetId) {
      setActionNotice('Vui lòng nhập từ khóa (VD: grab, shopee, siêu thị) và chọn thẻ/ví áp dụng!');
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    const currentRules = data.settings.autoPaymentRules || [];
    if (currentRules.length >= 30) {
      setActionNotice('Bạn đã đạt tối đa 30 quy tắc tự động.');
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    const existingIdx = currentRules.findIndex(
      r => r.keyword.toLowerCase() === cleanKw.toLowerCase()
    );
    const nextRules =
      existingIdx >= 0
        ? currentRules.map((r, i) => (i === existingIdx ? { keyword: cleanKw, accountId: targetId } : r))
        : [...currentRules, { keyword: cleanKw, accountId: targetId }];

    updateSettings({ autoPaymentRules: nextRules });
    if (keywordToAdd === undefined) {
      setRuleKeyword('');
    }
    const label = getPaymentTargetLabel(targetId, data);
    setActionNotice(`Đã bật tự động dùng "${label}" cho giao dịch chứa "${cleanKw}"!`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleDeleteAutoPaymentRule = (index: number) => {
    const currentRules = data.settings.autoPaymentRules || [];
    const nextRules = currentRules.filter((_, i) => i !== index);
    updateSettings({ autoPaymentRules: nextRules });
    setActionNotice('Đã xóa quy tắc tự động chọn thẻ.');
    setTimeout(() => setActionNotice(null), 2500);
  };

  const handleSaveMemberNames = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      memberNames: {
        child1: child1Name.trim() || 'Con 1',
        child2: child2Name.trim() || 'Con 2',
        me: meName.trim() || 'Bản thân tôi',
        spouse: spouseName.trim() || 'Chồng',
      },
    });
    setActionNotice('Đã cập nhật tên các thành viên trong gia đình thành công!');
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleAddCustomMember = (presetName?: string, presetAvatar?: string) => {
    const cleanName = (presetName ?? newMemberName).trim().slice(0, 40);
    if (!cleanName) {
      setActionNotice('Vui lòng nhập tên thành viên mới (VD: Ông nội, Bà ngoại, Con 3...)!');
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    const current = data.settings.customMembers || [];
    if (current.length >= 20) {
      setActionNotice('Bạn đã thêm tối đa 20 thành viên mở rộng.');
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    if (current.some(m => m.name.toLowerCase() === cleanName.toLowerCase())) {
      setActionNotice(`Thành viên "${cleanName}" đã có trong danh sách!`);
      setTimeout(() => setActionNotice(null), 2500);
      return;
    }

    const newMember = {
      id: 'mem_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: cleanName,
      avatar: presetAvatar || newMemberAvatar || '👤',
    };

    updateSettings({ customMembers: [...current, newMember] });
    if (presetName === undefined) setNewMemberName('');
    setActionNotice(`Đã thêm thành viên "${newMember.avatar} ${cleanName}" vào gia đình!`);
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleDeleteCustomMember = (id: string, name: string) => {
    if (!confirm(`Xóa thành viên "${name}" khỏi danh sách? (Các giao dịch cũ vẫn được giữ nguyên)`)) {
      return;
    }
    const next = (data.settings.customMembers || []).filter(m => m.id !== id);
    updateSettings({ customMembers: next });
    setActionNotice(`Đã xóa thành viên "${name}".`);
    setTimeout(() => setActionNotice(null), 2500);
  };

  const handleSaveLedgerName = (nameToSave?: string) => {
    const finalName = (nameToSave !== undefined ? nameToSave : ledgerNameInput).trim() || 'Sổ Thu Chi';
    setLedgerNameInput(finalName);
    updateSettings({ ledgerName: finalName });
    setActionNotice(`Đã đổi tên sổ thành "${finalName}"!`);
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleDeleteCategory = (catKey: string, catName: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa loại giao dịch "${catName}" không?`)) {
      deleteCustomCategory(catKey);
      setActionNotice(`Đã xóa loại "${catName}" thành công!`);
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseVietnameseMoneyText(budgetInput);
    updateSettings({ budget: val });
    setSaveSuccessMsg('Đã lưu hạn mức ngân sách thành công!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const success = importBackupJSON(text);
      if (success) {
        setActionNotice('Đã khôi phục dữ liệu từ file sao lưu thành công!');
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        setTimeout(() => setActionNotice(null), 4000);
      } else {
        alert('File sao lưu không hợp lệ. Vui lòng kiểm tra lại file JSON!');
      }
    };
    reader.readAsText(file);
  };

  const activeColorTheme = getColorThemeOption(data.settings.colorTheme);
  const activeAppearance = data.settings.theme || 'light';

  const handleSelectColorTheme = (themeId: ColorThemeId) => {
    const opt = getColorThemeOption(themeId);
    updateSettings({ colorTheme: themeId });
    setActionNotice(`Đã đổi giao diện sang màu "${opt.name}"!`);
    setTimeout(() => setActionNotice(null), 2800);
  };

  const handleSelectAppearance = (mode: 'light' | 'dark' | 'system') => {
    updateSettings({ theme: mode });
    const labels: Record<'light' | 'dark' | 'system', string> = {
      light: 'Chế độ Sáng',
      dark: 'Chế độ Tối',
      system: 'Tự động theo máy',
    };
    setActionNotice(`Đã chuyển sang ${labels[mode]}!`);
    setTimeout(() => setActionNotice(null), 2500);
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Title */}
      <div className="px-1">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cài Đặt Hệ Thống</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tùy biến tên sổ, hạn mức ngân sách, quyền riêng tư và sao lưu dữ liệu an toàn.
        </p>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 0. Cloud Account Sync Card (Mobile & Desktop) */}
      <div className="bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 dark:from-emerald-950/60 dark:via-teal-950/40 dark:to-slate-900 text-slate-900 dark:text-white rounded-3xl p-5 shadow-sm border border-emerald-200/90 dark:border-emerald-800/60 space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/85 dark:bg-white/10 border border-emerald-200/80 dark:border-white/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Avatar"
                  className="w-10 h-10 rounded-2xl object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Cloud size={20} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Đồng Bộ Điện Thoại & Máy Tính</span>
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium truncate">
                {user
                  ? `Đang dùng chung tài khoản: ${user.email}`
                  : 'Đăng nhập Google để tự động đồng bộ mọi thiết bị'}
              </p>
            </div>
          </div>

          {user && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/85 dark:bg-white/15 text-emerald-700 dark:text-emerald-200 border border-emerald-200/80 dark:border-white/15 shrink-0 flex items-center gap-1">
              {syncStatus === 'syncing' ? (
                <>
                  <RefreshCw size={10} className="animate-spin" />
                  <span>Đang lưu</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={10} />
                  <span>Đã đồng bộ</span>
                </>
              )}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Khi đăng nhập cùng 1 tài khoản Google trên <strong className="text-slate-900 dark:text-white">điện thoại</strong> và <strong className="text-slate-900 dark:text-white">máy tính</strong>, toàn bộ sổ thu chi, tài khoản ngân hàng, thẻ tín dụng và sổ tiết kiệm sẽ tự động khớp 100% theo thời gian thực.
        </p>

        {!user ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => (onOpenAccountSync ? onOpenAccountSync() : signInWithGoogle())}
              disabled={authLoading}
              className="flex-1 min-h-[44px] py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-sm shadow-emerald-400/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <Smartphone size={16} />
              <span>{authLoading ? 'Đang kết nối...' : 'Đăng Nhập Google Ngay'}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                await forceUploadAllToCloud();
                setActionNotice('Đã đồng bộ lại toàn bộ dữ liệu lên Đám mây thành công!');
                setTimeout(() => setActionNotice(null), 3500);
              }}
              disabled={syncStatus === 'syncing'}
              className="flex-1 min-h-[42px] py-2.5 px-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <RefreshCw size={15} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
              <span>Đồng bộ lại ngay</span>
            </button>
            {onOpenAccountSync && (
              <button
                type="button"
                onClick={onOpenAccountSync}
                className="min-h-[42px] py-2.5 px-4 rounded-2xl bg-white/85 hover:bg-white dark:bg-white/10 dark:hover:bg-white/20 border border-emerald-200/80 dark:border-white/20 text-emerald-700 dark:text-white font-bold text-xs cursor-pointer active:scale-95 transition-all"
              >
                Chi tiết
              </button>
            )}
            <button
              type="button"
              onClick={signOutUser}
              className="min-h-[42px] py-2.5 px-4 rounded-2xl bg-white/85 hover:bg-rose-50 dark:bg-white/10 dark:hover:bg-rose-500/30 border border-rose-200/80 dark:border-white/20 text-rose-600 dark:text-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <LogOut size={14} />
              <span>Đăng xuất</span>
            </button>
          </div>
        )}
      </div>

      {/* 0.2. Giao Diện & Màu Sắc (Theme Selector) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Palette size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Giao Diện Màu Pastel & Sáng / Tối
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Bảng màu pastel dịu nhẹ, hài hòa cho toàn bộ ứng dụng
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
            {activeColorTheme.name}
          </span>
        </div>

        {/* Color Theme Swatches */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
            1. Tông màu chủ đạo:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {COLOR_THEMES.map(opt => {
              const isSelected = activeColorTheme.id === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectColorTheme(opt.id)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] flex items-center gap-2.5 ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/25 shadow-xs'
                      : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white shadow-xs border border-white/40"
                    style={{
                      background: `linear-gradient(135deg, ${opt.swatchHex}, ${opt.secondaryHex})`,
                    }}
                  >
                    {isSelected && <Check size={15} strokeWidth={3} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {opt.name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Light / Dark Mode Switcher */}
        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
            2. Chế độ nền (Sáng / Tối):
          </label>
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            {[
              { id: 'light' as const, label: 'Sáng', Icon: Sun },
              { id: 'dark' as const, label: 'Tối', Icon: Moon },
              { id: 'system' as const, label: 'Theo máy', Icon: Monitor },
            ].map(({ id, label, Icon }) => {
              const active = activeAppearance === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectAppearance(id)}
                  className={`min-h-[42px] py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 0.5. Thẻ / Tài Khoản Thanh Toán Chính & Tự Động Cho Grab, Shopee, Siêu Thị */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Thẻ Thanh Toán Chính Tự Động</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tự động chọn sẵn thẻ/ví cho mọi khoản chi & các giao dịch như Grab, Shopee, siêu thị...
              </p>
            </div>
          </div>

          {data.settings.defaultPaymentAccountId && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0 flex items-center gap-1">
              <Star size={10} className="fill-current" />
              <span>Đang bật</span>
            </span>
          )}
        </div>

        {/* Step 1: Primary Default Card/Account */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
            1. Thẻ tín dụng / Tài khoản thanh toán chính mặc định:
          </label>
          <select
            value={data.settings.defaultPaymentAccountId || ''}
            onChange={e => handleSelectDefaultPaymentAccount(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
          >
            <option value="">-- Không đặt mặc định (chọn ví đầu tiên) --</option>
            {(data.cards || []).length > 0 && (
              <optgroup label="Thẻ tín dụng (Khuyên dùng cho Grab, Shopee, Siêu thị)">
                {data.cards.map(card => (
                  <option key={card.id} value={card.id}>
                    💳 {card.name} (Dư nợ: {formatVND(card.currentBalance)} / HM: {formatVND(card.limit)})
                  </option>
                ))}
              </optgroup>
            )}
            {(data.accts || []).length > 0 && (
              <optgroup label="Ví & Tài khoản ngân hàng">
                {data.accts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    🏦 {acc.name} (Số dư: {formatVND(acc.balance)})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Mỗi khi bấm <strong>+ Ghi sổ</strong>, <strong>Quét hóa đơn</strong> hoặc <strong>Bóc tách văn bản</strong>, ứng dụng sẽ tự động chọn sẵn thẻ/tài khoản này cho các khoản chi.
          </p>
        </div>

        {/* Step 2: Smart Keyword Rules (Grab, Shopee, Supermarket...) */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-500" />
              <span>2. Tự động chọn thẻ theo tên giao dịch / cửa hàng:</span>
            </label>
          </div>

          {/* 1-tap Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium mr-0.5">Thêm nhanh:</span>
            {[
              { label: '+ Grab / Grap / Be', kw: 'grab, grap, be, xanh sm' },
              { label: '+ Shopee / Lazada', kw: 'shopee, lazada, tiki, tiktok' },
              { label: '+ Siêu thị (WinMart, Co.op...)', kw: 'siêu thị, winmart, co.op, bách hóa xanh, aeon, lotte, go!' },
              { label: '+ Ăn uống / Cà phê', kw: 'highlands, starbucks, phúc long, trà sữa, cà phê' },
              { label: '+ Xăng xe', kw: 'xăng, petrolimex, pvoil' },
            ].map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleAddAutoPaymentRule(preset.kw)}
                className="min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/70 active:scale-95 transition-all cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom rule input */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              value={ruleKeyword}
              onChange={e => setRuleKeyword(e.target.value)}
              placeholder="Từ khóa (VD: grab, shopee, siêu thị...)"
              maxLength={80}
              className="sm:col-span-5 min-h-[42px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <select
              value={ruleTargetId}
              onChange={e => setRuleTargetId(e.target.value)}
              className="sm:col-span-5 min-h-[42px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {(data.cards || []).length > 0 && (
                <optgroup label="Thẻ tín dụng">
                  {data.cards.map(c => (
                    <option key={c.id} value={c.id}>💳 {c.name}</option>
                  ))}
                </optgroup>
              )}
              {(data.accts || []).length > 0 && (
                <optgroup label="Ví & Tài khoản">
                  {data.accts.map(a => (
                    <option key={a.id} value={a.id}>🏦 {a.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              onClick={() => handleAddAutoPaymentRule()}
              className="sm:col-span-2 min-h-[42px] py-2.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus size={15} />
              <span>Thêm</span>
            </button>
          </div>

          {/* Active Rules List */}
          {(data.settings.autoPaymentRules || []).length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(data.settings.autoPaymentRules || []).map((rule, idx) => {
                const targetLabel = getPaymentTargetLabel(rule.accountId, data) || 'Ví/Thẻ không tồn tại';
                return (
                  <div
                    key={`${rule.keyword}-${idx}`}
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-800 dark:text-slate-100 break-words">
                        “{rule.keyword}”
                      </span>
                      <span className="text-slate-400">➔</span>
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300 truncate">
                        {targetLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAutoPaymentRule(idx)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-50/70 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 active:scale-95 shrink-0 cursor-pointer transition-all"
                      title="Xóa quy tắc"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic">
              Chưa có quy tắc từ khóa riêng. Bạn có thể bấm các nút thêm nhanh ở trên (Grab, Shopee, Siêu thị...) nếu muốn gán riêng từng thẻ cho từng loại chi tiêu.
            </p>
          )}
        </div>
      </div>

      {/* 1. Tên Sổ Thu Chi (Customizable Ledger Name) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Tên Sổ Thu Chi Của Bạn
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Tên hiển thị trên thanh tiêu đề ứng dụng trên iPhone và máy tính.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={ledgerNameInput}
            onChange={e => setLedgerNameInput(e.target.value)}
            placeholder="VD: Sổ Thu Chi Gia Đình, Ví Chi Tiêu..."
            maxLength={30}
            className="flex-1 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <button
            type="button"
            onClick={() => handleSaveLedgerName()}
            className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-sm transition-all cursor-pointer shrink-0"
          >
            Lưu Tên
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-medium text-slate-400 mr-1">Gợi ý nhanh:</span>
          {[
            'Sổ Thu Chi Gia Đình',
            'Sổ Chi Tiêu Cá Nhân',
            'Quản Lý Tài Chính',
            'Ví Tiền Thông Minh',
          ].map(name => (
            <button
              key={name}
              type="button"
              onClick={() => handleSaveLedgerName(name)}
              className="min-h-[32px] px-3 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 active:scale-95 transition-all cursor-pointer"
            >
              +{name}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Thành Viên Gia Đình (Biệt danh / Nickname) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Thành Viên Gia Đình (Biệt Danh / Nickname)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Chỉ cần điền nickname thân mật để tiện ghi sổ và chia tiền cho con
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveMemberNames} className="space-y-3.5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Nickname Bản thân */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <span>👩</span>
                <span>Nickname của bạn:</span>
              </label>
              <input
                type="text"
                value={meName}
                onChange={e => setMeName(e.target.value)}
                placeholder="VD: Mẹ, Vợ, Em..."
                maxLength={20}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            {/* Nickname Chồng */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <span>👨</span>
                <span>Nickname của Chồng:</span>
              </label>
              <input
                type="text"
                value={spouseName}
                onChange={e => setSpouseName(e.target.value)}
                placeholder="VD: Bố, Chồng, Anh xã..."
                maxLength={20}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            {/* Nickname Con 1 */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <span>👦</span>
                <span>Nickname Con 1:</span>
              </label>
              <input
                type="text"
                value={child1Name}
                onChange={e => setChild1Name(e.target.value)}
                placeholder="VD: Bé Bin, Cún, Ken, Bảo Khang..."
                maxLength={20}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            {/* Nickname Con 2 */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <span>👧</span>
                <span>Nickname Con 2:</span>
              </label>
              <input
                type="text"
                value={child2Name}
                onChange={e => setChild2Name(e.target.value)}
                placeholder="VD: Bé Bông, Miu, Thỏ, Gia Hân..."
                maxLength={20}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          </div>

          {/* Quick Nickname Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-slate-400 font-medium mr-1">Gợi ý biệt danh:</span>
            {[
              { label: 'Bé Bin', target: 'child1' },
              { label: 'Bé Bông', target: 'child2' },
              { label: 'Cún', target: 'child1' },
              { label: 'Miu', target: 'child2' },
              { label: 'Mẹ', target: 'me' },
              { label: 'Bố', target: 'spouse' },
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.target === 'child1') setChild1Name(item.label);
                  if (item.target === 'child2') setChild2Name(item.label);
                  if (item.target === 'me') setMeName(item.label);
                  if (item.target === 'spouse') setSpouseName(item.label);
                }}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-violet-50 hover:text-violet-700 dark:bg-slate-800 dark:hover:bg-violet-950/40 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                +{item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400">
              * Khoản chi chọn "Cả 2 con" sẽ tự động chia 50/50 theo nickname của 2 bé.
            </span>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-sm transition-all cursor-pointer shrink-0"
            >
              Lưu Nickname
            </button>
          </div>
        </form>

        {/* Thêm Thành Viên Gia Đình Mở Rộng */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Thêm Thành Viên Khác ({(data.settings.customMembers || []).length})</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Thêm Ông bà, Bố mẹ, Con thứ 3, Em gái... để chọn nhanh khi ghi giao dịch & xem báo cáo
              </p>
            </div>
          </div>

          {/* Danh sách thành viên đã thêm */}
          {(data.settings.customMembers || []).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(data.settings.customMembers || []).map(member => (
                <div
                  key={member.id}
                  className="px-3 py-2 rounded-2xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/80 dark:border-violet-800/60 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">{member.avatar}</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {member.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomMember(member.id, member.name)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-50/70 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
                    title={`Xóa ${member.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Avatar Picker + Name Input */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                Biểu tượng:
              </span>
              {['👵', '👴', '👦', '👧', '👩', '👨', '🧑', '👶', '🤝'].map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setNewMemberAvatar(em)}
                  className={`w-9 h-9 rounded-xl text-base flex items-center justify-center transition-all cursor-pointer ${
                    newMemberAvatar === em
                      ? 'bg-violet-600 text-white ring-2 ring-violet-400 scale-105'
                      : 'bg-white dark:bg-slate-900 hover:bg-violet-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomMember();
                  }
                }}
                placeholder="Tên người mới (VD: Ông nội, Bà ngoại, Con 3...)"
                maxLength={40}
                className="flex-1 min-h-[42px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              <button
                type="button"
                onClick={() => handleAddCustomMember()}
                className="min-h-[42px] px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
              >
                <Plus size={15} />
                <span>Thêm người</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-400 font-medium">Thêm nhanh:</span>
              {[
                { name: 'Ông nội', avatar: '👴' },
                { name: 'Bà nội', avatar: '👵' },
                { name: 'Ông ngoại', avatar: '👴' },
                { name: 'Bà ngoại', avatar: '👵' },
                { name: 'Con 3', avatar: '👶' },
                { name: 'Em gái', avatar: '👧' },
              ].map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleAddCustomMember(p.name, p.avatar)}
                  className="min-h-[32px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  {p.avatar} +{p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Quản lý loại giao dịch tự tạo */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Loại Giao Dịch Tự Thêm ({customCategories.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsAddCatModalOpen(true)}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus size={15} strokeWidth={2.6} />
            <span>Thêm Loại Mới</span>
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Tự do tạo thêm các mục thu chi riêng (VD: Tiền ăn trưa cho tôi, Tiền ăn ngoài, Cà phê bạn bè...) kèm biểu tượng và màu sắc riêng.
        </p>

        {customCategories.length === 0 ? (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Bạn chưa tạo loại riêng nào. Ứng dụng đang dùng các danh mục tiêu chuẩn.
            </p>
            <button
              type="button"
              onClick={() => setIsAddCatModalOpen(true)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>+ Tạo loại đầu tiên (VD: Tiền ăn trưa)</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
            {customCategories.map(cat => (
              <div
                key={cat.key}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CategoryIcon iconName={cat.iconName} color={cat.color} name={cat.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {cat.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      <span className={cat.type === 'in' ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-rose-500 font-semibold'}>
                        {cat.type === 'in' ? 'Tiền vào' : 'Tiền ra'}
                      </span>
                      <span>·</span>
                      <span>{cat.section}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.key, cat.name)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-50/70 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 active:scale-95 transition-all cursor-pointer shrink-0"
                  title="Xóa loại này"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Monthly Budget */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Hạn Mức Ngân Sách Chi Tiêu Hàng Tháng
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Ứng dụng sẽ cảnh báo khi bạn chi tiêu vượt ngưỡng này để giúp bạn tiết kiệm tốt hơn.
        </p>

        <form onSubmit={handleSaveBudget} className="flex gap-2">
          <input
            type="text"
            value={budgetInput}
            onChange={e => setBudgetInput(e.target.value)}
            placeholder="VD: 15tr, 20000000"
            className="flex-1 min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <button
            type="submit"
            className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-sm transition-all shrink-0 cursor-pointer"
          >
            Lưu hạn mức
          </button>
        </form>

        {saveSuccessMsg && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 size={14} />
            <span>{saveSuccessMsg}</span>
          </p>
        )}
      </div>

      {/* 3. Privacy Mode Toggle */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-amber-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Chế Độ Ẩn Số Tiền (Privacy Mask)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Làm mờ tất cả các con số tiền tệ khi mở app ở nơi công cộng hoặc công ty.
          </p>
        </div>

        <button
          onClick={togglePrivacyMask}
          className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 cursor-pointer ${
            data.settings.privacyMask ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full bg-white shadow-xs transition-transform ${
              data.settings.privacyMask ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* 4. Sync & Deploy to GitHub / Vercel */}
      <div className="bg-gradient-to-br from-indigo-100 via-violet-50 to-emerald-50 dark:from-slate-900 dark:via-indigo-950/70 dark:to-slate-900 text-slate-900 dark:text-white rounded-3xl p-5 shadow-sm border border-indigo-200/80 dark:border-indigo-900/40 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/85 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-500/30 flex items-center justify-center shrink-0">
              <Rocket size={19} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Cập Nhật Lên Vercel & GitHub
              </h3>
              <p className="text-[11px] text-indigo-700/85 dark:text-indigo-200/80">
                Kho lưu trữ: <code className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">duongphamwork93/so-thu-chi</code>
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/85 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/30">
            Trực tiếp
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-indigo-100/90 leading-relaxed">
          Trang web Vercel của bạn (<code className="text-emerald-700 dark:text-emerald-400 font-mono font-semibold">so-thu-chi-delta.vercel.app</code>) kết nối trực tiếp với GitHub. Khi cập nhật tính năng mới từ AI Studio, bạn chỉ cần bấm nút dưới đây để đẩy lên GitHub, Vercel sẽ tự động build lại và cập nhật chỉ sau 30 giây!
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {onOpenGitHubModal && (
            <button
              type="button"
              onClick={onOpenGitHubModal}
              className="min-h-[44px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <Github size={16} />
              <span>Đẩy Lên GitHub Ngay</span>
            </button>
          )}

          <a
            href="/api/download/source"
            download="so-thu-chi-source.zip"
            className="min-h-[44px] py-3 px-4 rounded-2xl bg-white/85 hover:bg-white dark:bg-white/10 dark:hover:bg-white/15 border border-indigo-200/80 dark:border-white/15 text-indigo-700 dark:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all text-center shadow-xs"
          >
            <Download size={16} />
            <span>Tải Code Mới Nhất (.zip)</span>
          </a>
        </div>
      </div>

      {/* 5. Backup & Restore (Full compatibility with sothuchi.v1) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Sao Lưu & Khôi Phục Dữ Liệu
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Toàn bộ dữ liệu được lưu cục bộ an toàn trong trình duyệt hoặc ứng dụng trên iPhone của bạn (khóa{' '}
            <code className="text-emerald-600 font-mono">sothuchi.v1</code>). Xuất file JSON để cất giữ an tâm hoặc chuyển máy mới.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={exportBackupJSON}
            className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-3 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
              <Download size={20} />
            </div>
            <div>
              <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                Xuất file sao lưu (Backup)
              </p>
              <p className="text-[11px] text-slate-400">Tải file .json về máy an toàn</p>
            </div>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-3 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center shrink-0">
              <Upload size={20} />
            </div>
            <div>
              <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                Khôi phục từ file (Restore)
              </p>
              <p className="text-[11px] text-slate-400">Chọn file .json đã lưu</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </button>
        </div>
      </div>

      {/* 4.5. Cập nhật Biểu tượng (Icon) & Cài đặt App trên điện thoại */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="./apple-touch-icon.png?v=3"
              alt="Biểu tượng Sổ Thu Chi"
              className="w-12 h-12 rounded-2xl shadow-sm border border-emerald-200/80 dark:border-emerald-800/60 shrink-0 object-cover"
            />
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                <ImageIcon size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>Làm Mới Biểu Tượng Ngoài Màn Hình</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                iPhone & Android lưu cứng ảnh biểu tượng lúc bạn ghim lần đầu nên không tự đổi khi web cập nhật.
              </p>
            </div>
          </div>
          {isStandaloneApp && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
              Đang mở dạng App
            </span>
          )}
        </div>

        {canInstallPWA && (
          <button
            type="button"
            onClick={handleInstallPWA}
            className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Smartphone size={15} />
            <span>Cài Đặt / Cập Nhật App Ra Màn Hình Chính</span>
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] text-slate-600 dark:text-slate-300">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1">
            <p className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
              <Share size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Trên iPhone (Safari):</span>
            </p>
            <ol className="list-decimal pl-4 space-y-0.5 text-slate-500 dark:text-slate-400">
              <li>Nhấn giữ biểu tượng app cũ ngoài màn hình chính → <strong>Xóa dấu trang</strong>.</li>
              <li>Mở lại link web trên <strong>Safari</strong> và tải lại trang.</li>
              <li>Bấm <strong>Chia sẻ (Share)</strong> → <strong>Thêm vào Màn hình chính</strong> để nhận biểu tượng mới.</li>
            </ol>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1">
            <p className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
              <Smartphone size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Trên Android (Chrome):</span>
            </p>
            <ol className="list-decimal pl-4 space-y-0.5 text-slate-500 dark:text-slate-400">
              <li>Gỡ cài đặt lối tắt cũ ngoài màn hình chính.</li>
              <li>Mở lại trang web trong <strong>Chrome</strong> và bấm tải lại trang.</li>
              <li>Bấm <strong>⋮ → Cài đặt ứng dụng / Thêm vào màn hình chính</strong>.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* 5. Safe Data Explanation on iPhone & Upgrades */}
      <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 p-5 rounded-3xl border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed shadow-sm">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
          <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Bảo Toàn Dữ Liệu 100% Khi Nâng Cấp & Cài Lại App</span>
        </div>
        <p>
          <strong className="text-slate-900 dark:text-white">Dữ liệu của bạn có bị mất khi nâng cấp không?</strong>{' '}
          <span className="text-emerald-700 dark:text-emerald-300 font-bold">HOÀN TOÀN KHÔNG BỊ MẤT.</span>
        </p>
        <ul className="space-y-1.5 pl-4 list-disc text-slate-600 dark:text-slate-400">
          <li>
            Mọi giao dịch và tài sản bạn nhập được lưu độc lập trong bộ nhớ iPhone của bạn (Local Storage của miền <code className="text-emerald-600 dark:text-emerald-400 font-semibold">so-thu-chi-delta.vercel.app</code>).
          </li>
          <li>
            Mỗi lần cập nhật mã nguồn trên GitHub / Vercel, máy chủ chỉ tải giao diện mới nhất về, tuyệt đối không can thiệp hay xóa bộ nhớ lưu trữ cá nhân của bạn.
          </li>
          <li>
            Bạn có thể thoải mái thêm app vào Màn hình chính (PWA) trên iPhone, cập nhật mã nguồn tùy thích mà không lo mất dữ liệu.
          </li>
        </ul>
      </div>

      {/* Add Custom Category Modal */}
      <AddCategoryModal
        isOpen={isAddCatModalOpen}
        onClose={() => setIsAddCatModalOpen(false)}
      />
    </div>
  );
};
