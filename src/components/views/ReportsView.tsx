import React, { useEffect, useMemo, useState } from 'react';
import {
  PieChart as PieIcon,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Users,
  Baby,
  ChevronDown,
  ChevronUp,
  Layers,
  SlidersHorizontal,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { CategoryIcon } from '../CategoryIcon';
import { formatVND, formatVNDShort } from '../../utils/formatters';
import { JarTargets, Transaction } from '../../types/finance';
import { getBeneficiaries } from '../../constants/beneficiaries';

export type ReportMode = 'member' | 'category' | 'rule503020' | 'sixjars';

interface ReportsViewProps {
  onOpenAddModal?: () => void;
  initialMode?: ReportMode;
  initialType?: 'out' | 'in';
}

const DEFAULT_JARS: JarTargets = {
  nec: 55,
  ffa: 10,
  educ: 10,
  play: 10,
  give: 5,
  lts: 10,
};

export const ReportsView: React.FC<ReportsViewProps> = ({
  onOpenAddModal,
  initialMode,
  initialType,
}) => {
  const { data, currentMonth, shiftMonth, categoryMap, updateSettings } = useFinance();
  const [reportMode, setReportMode] = useState<ReportMode>(initialMode || 'member');
  const [reportType, setReportType] = useState<'out' | 'in'>(initialType || 'out');
  const [expandedMemberKey, setExpandedMemberKey] = useState<string | null>(null);
  const [isEditingJars, setIsEditingJars] = useState<boolean>(false);

  const jarTargets: JarTargets = data.settings.jarTargets || DEFAULT_JARS;
  const [draftJars, setDraftJars] = useState<JarTargets>(jarTargets);

  useEffect(() => {
    if (initialMode) setReportMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialType) setReportType(initialType);
  }, [initialType]);

  useEffect(() => {
    setDraftJars(data.settings.jarTargets || DEFAULT_JARS);
  }, [data.settings.jarTargets]);

  const beneficiariesList = useMemo(
    () => getBeneficiaries(data.settings.memberNames, data.settings.customMembers),
    [data.settings.memberNames, data.settings.customMembers]
  );

  const memberNames = data.settings.memberNames;
  const child1Name = memberNames?.child1?.trim() || 'Con 1';
  const child2Name = memberNames?.child2?.trim() || 'Con 2';
  const meName = memberNames?.me?.trim() || 'Bản thân tôi';
  const spouseName = memberNames?.spouse?.trim() || 'Chồng';

  // Month transactions excluding records flagged "Không tính vào báo cáo"
  const monthTransactions = useMemo(() => {
    return data.records.filter(
      r => r.date && r.date.startsWith(currentMonth) && !r.excludeFromReport
    );
  }, [data.records, currentMonth]);

  const expenseTransactions = useMemo(
    () => monthTransactions.filter(r => r.type === 'out'),
    [monthTransactions]
  );
  const incomeTransactions = useMemo(
    () => monthTransactions.filter(r => r.type === 'in'),
    [monthTransactions]
  );

  const totalExpense = useMemo(
    () => expenseTransactions.reduce((sum, r) => sum + r.amount, 0),
    [expenseTransactions]
  );
  const totalIncome = useMemo(
    () => incomeTransactions.reduce((sum, r) => sum + r.amount, 0),
    [incomeTransactions]
  );

  const activeTransactions = reportType === 'out' ? expenseTransactions : incomeTransactions;
  const currentTotal = reportType === 'out' ? totalExpense : totalIncome;

  // 1. MEMBER / BENEFICIARY BREAKDOWN
  const memberReport = useMemo(() => {
    let child1Total = 0;
    let child2Total = 0;
    let bothChildrenJointTotal = 0;
    let meTotal = 0;
    let spouseTotal = 0;
    let familyTotal = 0;

    const child1List: Array<Transaction & { splitNote?: string; allocatedAmount: number }> = [];
    const child2List: Array<Transaction & { splitNote?: string; allocatedAmount: number }> = [];
    const meList: Array<Transaction & { splitNote?: string; allocatedAmount: number }> = [];
    const spouseList: Array<Transaction & { splitNote?: string; allocatedAmount: number }> = [];
    const familyList: Array<Transaction & { splitNote?: string; allocatedAmount: number }> = [];

    const customMembers = data.settings.customMembers || [];
    const customStats = new Map<
      string,
      { total: number; list: Array<Transaction & { splitNote?: string; allocatedAmount: number }> }
    >();
    customMembers.forEach(cm => {
      customStats.set(cm.id, { total: 0, list: [] });
    });

    expenseTransactions.forEach(tx => {
      const b = tx.beneficiary || 'family';

      if (b === 'child1') {
        child1Total += tx.amount;
        child1List.push({ ...tx, allocatedAmount: tx.amount });
      } else if (b === 'child2') {
        child2Total += tx.amount;
        child2List.push({ ...tx, allocatedAmount: tx.amount });
      } else if (b === 'both_children') {
        bothChildrenJointTotal += tx.amount;
        const half = Math.round(tx.amount / 2);
        const secondHalf = tx.amount - half;

        child1Total += half;
        child2Total += secondHalf;

        child1List.push({
          ...tx,
          allocatedAmount: half,
          splitNote: `Chia 50% từ khoản chung cả 2 con (${formatVND(tx.amount)})`,
        });
        child2List.push({
          ...tx,
          allocatedAmount: secondHalf,
          splitNote: `Chia 50% từ khoản chung cả 2 con (${formatVND(tx.amount)})`,
        });
      } else if (b === 'me') {
        meTotal += tx.amount;
        meList.push({ ...tx, allocatedAmount: tx.amount });
      } else if (b === 'spouse') {
        spouseTotal += tx.amount;
        spouseList.push({ ...tx, allocatedAmount: tx.amount });
      } else if (customStats.has(b)) {
        const entry = customStats.get(b)!;
        entry.total += tx.amount;
        entry.list.push({ ...tx, allocatedAmount: tx.amount });
      } else {
        familyTotal += tx.amount;
        familyList.push({ ...tx, allocatedAmount: tx.amount });
      }
    });

    const totalChildren = child1Total + child2Total;
    const customTotalSum = Array.from(customStats.values()).reduce((s, e) => s + e.total, 0);
    const totalAllocated = totalChildren + meTotal + spouseTotal + familyTotal + customTotalSum;

    const customMemberCards = beneficiariesList
      .filter(b => b.isCustom)
      .map(b => {
        const st = customStats.get(b.key) || { total: 0, list: [] };
        return {
          key: b.key,
          name: b.name,
          avatar: b.avatar,
          color: b.color,
          bgColor: b.bgColor,
          borderColor: b.borderColor,
          textColor: b.textColor,
          amount: st.total,
          percentage: totalExpense > 0 ? (st.total / totalExpense) * 100 : 0,
          transactions: st.list,
          description: b.description,
        };
      });

    const members = [
      {
        key: 'child1',
        name: child1Name,
        avatar: '👦',
        color: '#F59E0B',
        bgColor: 'bg-amber-50 dark:bg-amber-950/40',
        borderColor: 'border-amber-200 dark:border-amber-800',
        textColor: 'text-amber-700 dark:text-amber-300',
        amount: child1Total,
        percentage: totalExpense > 0 ? (child1Total / totalExpense) * 100 : 0,
        transactions: child1List,
        description: 'Bao gồm chi riêng và 50% chi chung 2 con',
      },
      {
        key: 'child2',
        name: child2Name,
        avatar: '👧',
        color: '#EC4899',
        bgColor: 'bg-pink-50 dark:bg-pink-950/40',
        borderColor: 'border-pink-200 dark:border-pink-800',
        textColor: 'text-pink-700 dark:text-pink-300',
        amount: child2Total,
        percentage: totalExpense > 0 ? (child2Total / totalExpense) * 100 : 0,
        transactions: child2List,
        description: 'Bao gồm chi riêng và 50% chi chung 2 con',
      },
      {
        key: 'me',
        name: meName,
        avatar: '👩',
        color: '#8B5CF6',
        bgColor: 'bg-violet-50 dark:bg-violet-950/40',
        borderColor: 'border-violet-200 dark:border-violet-800',
        textColor: 'text-violet-700 dark:text-violet-300',
        amount: meTotal,
        percentage: totalExpense > 0 ? (meTotal / totalExpense) * 100 : 0,
        transactions: meList,
        description: 'Chi tiêu riêng cá nhân tôi',
      },
      {
        key: 'spouse',
        name: spouseName,
        avatar: '👨',
        color: '#3B82F6',
        bgColor: 'bg-blue-50 dark:bg-blue-950/40',
        borderColor: 'border-blue-200 dark:border-blue-800',
        textColor: 'text-blue-700 dark:text-blue-300',
        amount: spouseTotal,
        percentage: totalExpense > 0 ? (spouseTotal / totalExpense) * 100 : 0,
        transactions: spouseList,
        description: 'Khoản chi riêng cho chồng',
      },
      ...customMemberCards,
      {
        key: 'family',
        name: 'Chung (Cả nhà)',
        avatar: '🏠',
        color: '#0D9488',
        bgColor: 'bg-teal-50 dark:bg-teal-950/40',
        borderColor: 'border-teal-200 dark:border-teal-800',
        textColor: 'text-teal-700 dark:text-teal-300',
        amount: familyTotal,
        percentage: totalExpense > 0 ? (familyTotal / totalExpense) * 100 : 0,
        transactions: familyList,
        description: 'Điện nước, tiền nhà, ăn uống sinh hoạt chung',
      },
    ];

    return {
      child1Total,
      child2Total,
      bothChildrenJointTotal,
      totalChildren,
      meTotal,
      spouseTotal,
      familyTotal,
      totalAllocated,
      members,
    };
  }, [expenseTransactions, totalExpense, child1Name, child2Name, meName, spouseName, data.settings.customMembers, beneficiariesList]);

  // 2. CATEGORY BREAKDOWN
  const categoryStats = useMemo(() => {
    const map: Record<string, number> = {};
    activeTransactions.forEach(tx => {
      map[tx.cat] = (map[tx.cat] || 0) + tx.amount;
    });

    const entries = Object.entries(map).map(([catKey, amount]) => {
      const cat = categoryMap[catKey] || {
        key: catKey,
        name: 'Khác',
        shortName: 'Khác',
        color: '#64748B',
        iconName: 'CircleEllipsis',
        group: reportType === 'out' ? 'need' : 'income',
        section: reportType === 'out' ? 'Sinh hoạt' : 'Thu nhập',
      };
      const percentage = currentTotal > 0 ? (amount / currentTotal) * 100 : 0;
      return {
        catKey,
        cat,
        amount,
        percentage,
      };
    });

    return entries.sort((a, b) => b.amount - a.amount);
  }, [activeTransactions, currentTotal, categoryMap, reportType]);

  // 3. 50/30/20 RULE
  const rule503020 = useMemo(() => {
    const totals = { need: 0, want: 0, save: 0 };
    expenseTransactions.forEach(tx => {
      const cat = categoryMap[tx.cat];
      const grp = cat?.group === 'need' ? 'need' : cat?.group === 'save' ? 'save' : 'want';
      totals[grp] += tx.amount;
    });

    const needPct = totalExpense > 0 ? Math.round((totals.need / totalExpense) * 100) : 0;
    const wantPct = totalExpense > 0 ? Math.round((totals.want / totalExpense) * 100) : 0;
    const savePct = totalExpense > 0 ? Math.round((totals.save / totalExpense) * 100) : 0;

    return { totals, needPct, wantPct, savePct };
  }, [expenseTransactions, totalExpense, categoryMap]);

  // 4. 6 JARS FINANCIAL ANALYSIS (NEC, FFA, EDUC, PLAY, GIVE, LTS)
  const sixJarsReport = useMemo(() => {
    const sums: Record<keyof JarTargets, number> = {
      nec: 0,
      ffa: 0,
      educ: 0,
      play: 0,
      give: 0,
      lts: 0,
    };

    expenseTransactions.forEach(tx => {
      const cat = categoryMap[tx.cat];
      const catNameLower = (cat?.name || '').toLowerCase();
      const noteLower = (tx.note || '').toLowerCase();

      if (
        tx.cat === 'giao_duc' ||
        tx.cat === 'hoc_hanh' ||
        tx.cat === 'con_sach_vo' ||
        catNameLower.includes('học') ||
        catNameLower.includes('sách')
      ) {
        sums.educ += tx.amount;
      } else if (
        tx.cat === 'hieu_hi' ||
        tx.cat === 'cuoi_xin' ||
        tx.cat === 'tham_hoi' ||
        tx.cat === 'ma_chay' ||
        catNameLower.includes('tặng') ||
        catNameLower.includes('từ thiện')
      ) {
        sums.give += tx.amount;
      } else if (
        noteLower.includes('đầu tư') ||
        noteLower.includes('chứng khoán') ||
        noteLower.includes('vàng') ||
        catNameLower.includes('đầu tư')
      ) {
        sums.ffa += tx.amount;
      } else if (tx.cat === 'tiet_kiem' || cat?.group === 'save') {
        sums.lts += tx.amount;
      } else if (cat?.group === 'need') {
        sums.nec += tx.amount;
      } else {
        sums.play += tx.amount;
      }
    });

    const baseDenominator = totalIncome > 0 ? totalIncome : Math.max(totalExpense, 1);

    const jars: Array<{
      key: keyof JarTargets;
      code: string;
      label: string;
      desc: string;
      color: string;
      actual: number;
      targetPct: number;
      actualPct: number;
      targetAmount: number;
    }> = [
      {
        key: 'nec',
        code: 'NEC',
        label: 'Chi tiêu thiết yếu',
        desc: 'Ăn uống, nhà cửa, điện nước, đi lại, y tế',
        color: '#059669',
        actual: sums.nec,
        targetPct: jarTargets.nec,
        actualPct: totalExpense > 0 || totalIncome > 0 ? Math.round((sums.nec / baseDenominator) * 100) : 0,
        targetAmount: Math.round((baseDenominator * jarTargets.nec) / 100),
      },
      {
        key: 'ffa',
        code: 'FFA',
        label: 'Tự do tài chính',
        desc: 'Đầu tư chứng khoán, vàng, quỹ, tạo thu nhập thụ động',
        color: '#0D9488',
        actual: sums.ffa,
        targetPct: jarTargets.ffa,
        actualPct: totalExpense > 0 || totalIncome > 0 ? Math.round((sums.ffa / baseDenominator) * 100) : 0,
        targetAmount: Math.round((baseDenominator * jarTargets.ffa) / 100),
      },
      {
        key: 'educ',
        code: 'EDUC',
        label: 'Giáo dục & Phát triển',
        desc: 'Học phí, sách vở, khóa học nâng cao',
        color: '#0891B2',
        actual: sums.educ,
        targetPct: jarTargets.educ,
        actualPct: totalExpense > 0 || totalIncome > 0 ? Math.round((sums.educ / baseDenominator) * 100) : 0,
        targetAmount: Math.round((baseDenominator * jarTargets.educ) / 100),
      },
      {
        key: 'play',
        code: 'PLAY',
        label: 'Hưởng thụ cuộc sống',
        desc: 'Cà phê, giải trí, du lịch, mua sắm sở thích',
        color: '#F59E0B',
        actual: sums.play,
        targetPct: jarTargets.play,
        actualPct: totalExpense > 0 || totalIncome > 0 ? Math.round((sums.play / baseDenominator) * 100) : 0,
        targetAmount: Math.round((baseDenominator * jarTargets.play) / 100),
      },
      {
        key: 'give',
        code: 'GIVE',
        label: 'Cho đi & Hiếu hỉ',
        desc: 'Quà tặng, đám cưới, thăm hỏi, thiện nguyện',
        color: '#EC4899',
        actual: sums.give,
        targetPct: jarTargets.give,
        actualPct: totalExpense > 0 || totalIncome > 0 ? Math.round((sums.give / baseDenominator) * 100) : 0,
        targetAmount: Math.round((baseDenominator * jarTargets.give) / 100),
      },
      {
        key: 'lts',
        code: 'LTS',
        label: 'Tiết kiệm dài hạn',
        desc: 'Quỹ dự phòng, mục tiêu lớn, mua nhà/xe',
        color: '#4F46E5',
        actual: sums.lts,
        targetPct: jarTargets.lts,
        actualPct: totalExpense > 0 || totalIncome > 0 ? Math.round((sums.lts / baseDenominator) * 100) : 0,
        targetAmount: Math.round((baseDenominator * jarTargets.lts) / 100),
      },
    ];

    return {
      jars,
      baseLabel: totalIncome > 0 ? 'thu nhập tháng' : 'tổng chi tháng',
      baseDenominator,
    };
  }, [expenseTransactions, categoryMap, jarTargets, totalIncome, totalExpense]);

  // SVG Donut calculation for Categories
  const donutSlices = useMemo(() => {
    if (currentTotal === 0 || categoryStats.length === 0) return [];

    let currentAngle = 0;
    return categoryStats.map(item => {
      const angle = (item.amount / currentTotal) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle += angle;

      const startRad = (startAngle - 90) * (Math.PI / 180);
      const endRad = (endAngle - 90) * (Math.PI / 180);

      const rOuter = 85;
      const rInner = 55;
      const cx = 100;
      const cy = 100;

      const x1 = cx + rOuter * Math.cos(startRad);
      const y1 = cy + rOuter * Math.sin(startRad);
      const x2 = cx + rOuter * Math.cos(endRad);
      const y2 = cy + rOuter * Math.sin(endRad);

      const x3 = cx + rInner * Math.cos(endRad);
      const y3 = cy + rInner * Math.sin(endRad);
      const x4 = cx + rInner * Math.cos(startRad);
      const y4 = cy + rInner * Math.sin(startRad);

      const largeArc = angle > 180 ? 1 : 0;

      const pathData =
        categoryStats.length === 1
          ? `M ${cx} ${cy - rOuter} A ${rOuter} ${rOuter} 0 1 1 ${cx - 0.01} ${cy - rOuter} M ${cx} ${cy - rInner} A ${rInner} ${rInner} 0 1 0 ${cx - 0.01} ${cy - rInner} Z`
          : `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;

      return {
        ...item,
        pathData,
        color: item.cat.color,
      };
    });
  }, [categoryStats, currentTotal]);

  const monthParts = currentMonth.split('-');
  const monthDisplay = `Tháng ${parseInt(monthParts[1], 10)}/${monthParts[0]}`;
  const draftJarSum =
    draftJars.nec + draftJars.ffa + draftJars.educ + draftJars.play + draftJars.give + draftJars.lts;

  const handleSaveJarTargets = () => {
    if (draftJarSum !== 100) return;
    updateSettings({ jarTargets: draftJars });
    setIsEditingJars(false);
  };

  return (
    <div className="space-y-4 pb-36">
      {/* 1. Header Bar: Month Switcher & Title */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <PieIcon size={20} strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
              Báo Cáo Tài Chính
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cá nhân, danh mục, 50/30/20 & 6 Hũ tài chính
            </p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
          <button
            onClick={() => shiftMonth(-1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
            title="Tháng trước"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="px-2 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
            <Calendar size={13} className="text-cyan-600 shrink-0" />
            <span>{monthDisplay}</span>
          </div>
          <button
            onClick={() => shiftMonth(1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
            title="Tháng sau"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 2. Top Segmented Mode Switcher (4 modes cleanly responsive) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setReportMode('member')}
          className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            reportMode === 'member'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Users size={14} className={reportMode === 'member' ? 'text-emerald-600' : ''} />
          <span className="truncate">Cá Nhân & Con</span>
        </button>

        <button
          type="button"
          onClick={() => setReportMode('category')}
          className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            reportMode === 'category'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <PieIcon size={14} className={reportMode === 'category' ? 'text-emerald-600' : ''} />
          <span className="truncate">Theo Danh Mục</span>
        </button>

        <button
          type="button"
          onClick={() => setReportMode('rule503020')}
          className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            reportMode === 'rule503020'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <ShieldCheck size={14} className={reportMode === 'rule503020' ? 'text-emerald-600' : ''} />
          <span className="truncate">Quy Tắc 50/30/20</span>
        </button>

        <button
          type="button"
          onClick={() => setReportMode('sixjars')}
          className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            reportMode === 'sixjars'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-extrabold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Layers size={14} className={reportMode === 'sixjars' ? 'text-emerald-600' : ''} />
          <span className="truncate">Phân Tích 6 Hũ</span>
        </button>
      </div>

      {/* MODE 1: MEMBER BREAKDOWN */}
      {reportMode === 'member' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-pink-500 text-white rounded-3xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-100 flex items-center gap-1.5">
                <Baby size={16} />
                <span>Tổng Chi Cho 2 Con Tháng Này</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-black backdrop-blur-xs">
                {totalExpense > 0 ? Math.round((memberReport.totalChildren / totalExpense) * 100) : 0}% tổng chi
              </span>
            </div>

            <div className="money-mask text-3xl sm:text-4xl font-black tracking-tight tabular-nums">
              {formatVND(memberReport.totalChildren)}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/20">
              <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-2xl">
                <span className="text-[11px] font-semibold text-amber-100 block">👦 {child1Name}</span>
                <span className="money-mask text-sm sm:text-base font-extrabold tabular-nums">
                  {formatVND(memberReport.child1Total)}
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-2xl">
                <span className="text-[11px] font-semibold text-pink-100 block">👧 {child2Name}</span>
                <span className="money-mask text-sm sm:text-base font-extrabold tabular-nums">
                  {formatVND(memberReport.child2Total)}
                </span>
              </div>
            </div>

            {memberReport.bothChildrenJointTotal > 0 && (
              <p className="text-[11px] text-amber-100/90 leading-tight">
                Trong đó có <strong>{formatVND(memberReport.bothChildrenJointTotal)}</strong> là các khoản chi chung cho cả 2 con (tự động chia đôi 50/50).
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
              <span>Cơ Cấu Chi Tiêu Cá Nhân</span>
              <span className="text-slate-400 tabular-nums">Tổng: {formatVND(totalExpense)}</span>
            </div>

            <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              {memberReport.members.map(m => (
                <div
                  key={m.key}
                  style={{ width: `${m.percentage}%`, backgroundColor: m.color }}
                  className="h-full transition-all"
                  title={`${m.name}: ${formatVND(m.amount)} (${Math.round(m.percentage)}%)`}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2 text-xs pt-1">
              {memberReport.members.map(m => (
                <div key={m.key} className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                  <span>{m.name}:</span>
                  <span className="font-bold text-slate-900 dark:text-white money-mask">
                    {Math.round(m.percentage)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Chi Tiết Từng Người Thụ Hưởng ({memberReport.members.length})
              </span>
              <span className="text-[11px] text-slate-400">Chạm thẻ để xem từng giao dịch</span>
            </div>

            {memberReport.members.map(m => {
              const isExpanded = expandedMemberKey === m.key;

              return (
                <div
                  key={m.key}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedMemberKey(isExpanded ? null : m.key)}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                        {m.avatar}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                            {m.name}
                          </h4>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${m.color}20`, color: m.color }}
                          >
                            {Math.round(m.percentage)}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{m.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className="money-mask font-black text-sm sm:text-base text-slate-900 dark:text-white tabular-nums">
                          {formatVND(m.amount)}
                        </span>
                        <p className="text-[11px] text-slate-400">
                          {m.transactions.length} khoản
                        </p>
                      </div>
                      <div className="text-slate-400">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-2">
                        Danh sách các khoản chi của {m.name}:
                      </div>

                      {m.transactions.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          Chưa có khoản chi nào ghi cho người này trong {monthDisplay}.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-64 overflow-y-auto pr-1">
                          {m.transactions.map((tx, idx) => {
                            const cat = categoryMap[tx.cat];
                            return (
                              <div key={tx.id || idx} className="py-2.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <CategoryIcon catKey={tx.cat} size="sm" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {tx.note || cat?.name || 'Chi tiêu'}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                      <span>{tx.date}</span>
                                      {cat?.name && (
                                        <>
                                          <span>·</span>
                                          <span>{cat.name}</span>
                                        </>
                                      )}
                                    </div>
                                    {tx.splitNote && (
                                      <span className="inline-block mt-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-1.5 py-0.5 rounded">
                                        {tx.splitNote}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="money-mask font-bold text-xs sm:text-sm text-rose-500 tabular-nums">
                                    -{formatVND(tx.allocatedAmount)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 2: CATEGORY BREAKDOWN WITH DONUT */}
      {reportMode === 'category' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
            <button
              type="button"
              onClick={() => setReportType('out')}
              className={`py-2 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                reportType === 'out'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft size={16} strokeWidth={2.4} />
              <span>Khoản Chi</span>
            </button>
            <button
              type="button"
              onClick={() => setReportType('in')}
              className={`py-2 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                reportType === 'in'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight size={16} strokeWidth={2.4} />
              <span>Khoản Thu</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                {reportType === 'out' ? 'Tổng chi tiêu trong tháng' : 'Tổng thu nhập trong tháng'}
              </span>
              <span className="text-lg sm:text-xl font-black money-mask text-slate-900 dark:text-white tabular-nums">
                {formatVND(currentTotal)}
              </span>
            </div>

            {currentTotal === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                  <PieIcon size={24} />
                </div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {reportType === 'out' ? 'Chưa có khoản chi nào trong tháng này' : 'Chưa có khoản thu nào trong tháng này'}
                </p>
                {onOpenAddModal && (
                  <button
                    type="button"
                    onClick={onOpenAddModal}
                    className="px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    + Ghi giao dịch ngay
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                    {donutSlices.map((slice, i) => (
                      <path
                        key={slice.catKey + i}
                        d={slice.pathData}
                        fill={slice.color}
                        className="transition-all hover:opacity-80 cursor-pointer"
                      >
                        <title>{`${slice.cat.name}: ${formatVND(slice.amount)} (${Math.round(slice.percentage)}%)`}</title>
                      </path>
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-[11px] font-semibold text-slate-400">Tổng cộng</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white money-mask">
                      {formatVNDShort(currentTotal)}
                    </span>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-2">
                  {categoryStats.slice(0, 4).map(item => (
                    <div
                      key={item.catKey}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.cat.color }} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 tabular-nums">
                        <span className="font-bold text-slate-400">{Math.round(item.percentage)}%</span>
                        <span className="font-bold text-slate-900 dark:text-white money-mask">
                          {formatVND(item.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {categoryStats.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {reportType === 'out' ? 'Xếp Hạng Danh Mục Chi Tiêu' : 'Xếp Hạng Danh Mục Thu Nhập'} ({categoryStats.length})
              </h3>

              <div className="space-y-3">
                {categoryStats.map(item => (
                  <div key={item.catKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryIcon catKey={item.catKey} size="sm" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-bold shrink-0 tabular-nums">
                        <span className="text-slate-400 text-xs">{Math.round(item.percentage)}%</span>
                        <span className="money-mask text-slate-900 dark:text-white">
                          {formatVND(item.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, item.percentage)}%`, backgroundColor: item.cat.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 3: 50/30/20 RULE */}
      {reportMode === 'rule503020' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Đánh Giá Chuẩn Tài Chính 50/30/20
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-400">{monthDisplay}</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Mô hình phân bổ chi tiêu chuẩn quốc tế giúp bạn cân bằng cuộc sống và gia tăng tài sản dài hạn.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                <span>Thiết Yếu (Need)</span>
                <span>{rule503020.needPct}% / 50%</span>
              </div>
              <p className="text-base font-extrabold text-amber-950 dark:text-amber-200 money-mask tabular-nums">
                {formatVND(rule503020.totals.need)}
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400">
                Ăn uống, nhà ở, điện nước, đi lại
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/50 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-purple-800 dark:text-purple-300">
                <span>Cá Nhân (Want)</span>
                <span>{rule503020.wantPct}% / 30%</span>
              </div>
              <p className="text-base font-extrabold text-purple-950 dark:text-purple-200 money-mask tabular-nums">
                {formatVND(rule503020.totals.want)}
              </p>
              <p className="text-[11px] text-purple-700/80 dark:text-purple-400">
                Mua sắm, cà phê, du lịch, giải trí
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <span>Tích Lũy (Save)</span>
                <span>{rule503020.savePct}% / 20%</span>
              </div>
              <p className="text-base font-extrabold text-emerald-950 dark:text-emerald-200 money-mask tabular-nums">
                {formatVND(rule503020.totals.save)}
              </p>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
                Đầu tư, trả góp, gửi tiết kiệm
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODE 4: 6 JARS FINANCIAL ANALYSIS (MISA NEC/FFA/EDUC/PLAY/GIVE/LTS) */}
      {reportMode === 'sixjars' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Layers size={19} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                    Phân Tích Tài Chính 6 Hũ
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    So sánh tỷ lệ chi thực tế theo {sixJarsReport.baseLabel} ({formatVNDShort(sixJarsReport.baseDenominator)})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingJars(prev => !prev)}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <SlidersHorizontal size={13} />
                <span>Thiết lập %</span>
              </button>
            </div>

            {/* Settings Editor Drawer for 6 Jars */}
            {isEditingJars && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    Tùy chỉnh tỷ lệ % mục tiêu 6 Hũ
                  </span>
                  <span
                    className={`font-extrabold tabular-nums ${
                      draftJarSum === 100 ? 'text-emerald-600' : 'text-rose-500'
                    }`}
                  >
                    Tổng: {draftJarSum}% / 100%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { k: 'nec', label: 'NEC (Thiết yếu)' },
                      { k: 'ffa', label: 'FFA (Đầu tư)' },
                      { k: 'educ', label: 'EDUC (Giáo dục)' },
                      { k: 'play', label: 'PLAY (Hưởng thụ)' },
                      { k: 'give', label: 'GIVE (Cho đi)' },
                      { k: 'lts', label: 'LTS (Tiết kiệm)' },
                    ] as Array<{ k: keyof JarTargets; label: string }>
                  ).map(item => (
                    <div key={item.k} className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                        {item.label}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draftJars[item.k]}
                          onChange={e =>
                            setDraftJars(prev => ({
                              ...prev,
                              [item.k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                            }))
                          }
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white pr-7 tabular-nums"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                          %
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDraftJars(DEFAULT_JARS)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Mặc định (55/10/10/10/5/10)</span>
                  </button>

                  <button
                    type="button"
                    disabled={draftJarSum !== 100}
                    onClick={handleSaveJarTargets}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>Lưu tỷ lệ</span>
                  </button>
                </div>
              </div>
            )}

            {/* 6 Jars Bars Overview */}
            <div className="space-y-3">
              {sixJarsReport.jars.map(jar => {
                const isOver = jar.actualPct > jar.targetPct && (jar.key === 'nec' || jar.key === 'play');
                return (
                  <div
                    key={jar.key}
                    className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-black text-white"
                            style={{ backgroundColor: jar.color }}
                          >
                            {jar.code}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {jar.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{jar.desc}</p>
                      </div>

                      <div className="text-right shrink-0 tabular-nums">
                        <p className="money-mask text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                          {formatVND(jar.actual)}
                        </p>
                        <p
                          className={`text-[11px] font-bold ${
                            isOver ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          Thực tế {jar.actualPct}% · Mục tiêu {jar.targetPct}%
                        </p>
                      </div>
                    </div>

                    {/* Dual Progress Visual: Actual vs Target Marker */}
                    <div className="relative h-2.5 w-full bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, jar.actualPct)}%`,
                          backgroundColor: isOver ? '#F43F5E' : jar.color,
                        }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-900/70 dark:bg-white/80"
                        style={{ left: `${Math.min(99, jar.targetPct)}%` }}
                        title={`Mục tiêu: ${jar.targetPct}% (${formatVND(jar.targetAmount)})`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
