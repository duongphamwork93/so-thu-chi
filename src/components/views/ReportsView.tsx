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
import { usePlus } from '../../context/PlusContext';
import { CategoryIcon } from '../CategoryIcon';
import { formatDateVietnamese, formatVND, formatVNDShort } from '../../utils/formatters';
import { JarTargets, Transaction } from '../../types/finance';
import { getBeneficiaries } from '../../constants/beneficiaries';
import { EditTransactionModal } from '../modals/EditTransactionModal';
import { classifyJar, DEFAULT_JARS } from '../../utils/jars';
import { JarSettingsModal } from '../modals/JarSettingsModal';
import { canonicalCategoryKey } from '../../constants/categories';

export type ReportMode = 'member' | 'category' | 'rule503020' | 'sixjars';

interface ReportsViewProps {
  onOpenAddModal?: () => void;
  initialMode?: ReportMode;
  initialType?: 'out' | 'in';
}



export const ReportsView: React.FC<ReportsViewProps> = ({
  onOpenAddModal,
  initialMode,
  initialType,
}) => {
  const { data, currentMonth, shiftMonth, categoryMap, updateSettings } = useFinance();
  const { isInPeriod, periodRange, plus } = usePlus();
  const [reportMode, setReportMode] = useState<ReportMode>(initialMode || 'member');
  const [reportType, setReportType] = useState<'out' | 'in'>(initialType || 'out');
  const [expandedMemberKey, setExpandedMemberKey] = useState<string | null>(null);
  const [expandedCategoryKey, setExpandedCategoryKey] = useState<string | null>(null);
  const [expandedRuleGroup, setExpandedRuleGroup] = useState<'need' | 'want' | 'save' | null>(null);
  const [expandedJarKey, setExpandedJarKey] = useState<keyof JarTargets | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
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

  useEffect(() => {
    setExpandedJarKey(null);
    setExpandedCategoryKey(null);
    setExpandedRuleGroup(null);
  }, [currentMonth]);

  useEffect(() => {
    setExpandedCategoryKey(null);
  }, [reportType]);

  const getPaySourceLabel = (accountId?: string) => {
    if (!accountId) return '';
    const acct = data.accts.find(a => a.id === accountId);
    if (acct) return acct.name;
    const card = data.cards.find(c => c.id === accountId);
    return card ? card.name : '';
  };

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
    return data.records.filter(r => isInPeriod(r.date) && !r.excludeFromReport);
  }, [data.records, isInPeriod]);

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
    const map: Record<string, { amount: number; transactions: Transaction[] }> = {};
    activeTransactions.forEach(tx => {
      const key = canonicalCategoryKey(tx.cat);
      if (!map[key]) {
        map[key] = { amount: 0, transactions: [] };
      }
      map[key].amount += tx.amount;
      map[key].transactions.push(tx);
    });

    const entries = Object.entries(map).map(([catKey, entry]) => {
      const cat = categoryMap[catKey] || {
        key: catKey,
        name: 'Khác',
        shortName: 'Khác',
        color: '#64748B',
        iconName: 'CircleEllipsis',
        group: reportType === 'out' ? 'need' : 'income',
        section: reportType === 'out' ? 'Sinh hoạt' : 'Thu nhập',
      };
      const percentage = currentTotal > 0 ? (entry.amount / currentTotal) * 100 : 0;
      const sortedTransactions = [...entry.transactions].sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.amount - a.amount;
      });
      return {
        catKey,
        cat,
        amount: entry.amount,
        percentage,
        transactions: sortedTransactions,
      };
    });

    return entries.sort((a, b) => b.amount - a.amount);
  }, [activeTransactions, currentTotal, categoryMap, reportType]);

  // 3. 50/30/20 RULE
  const rule503020 = useMemo(() => {
    const totals = { need: 0, want: 0, save: 0 };
    const lists: Record<'need' | 'want' | 'save', Transaction[]> = {
      need: [],
      want: [],
      save: [],
    };
    expenseTransactions.forEach(tx => {
      const cat = categoryMap[tx.cat];
      const grp = cat?.group === 'need' ? 'need' : cat?.group === 'save' ? 'save' : 'want';
      totals[grp] += tx.amount;
      lists[grp].push(tx);
    });

    (['need', 'want', 'save'] as const).forEach(k => {
      lists[k].sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.amount - a.amount;
      });
    });

    const needPct = totalExpense > 0 ? Math.round((totals.need / totalExpense) * 100) : 0;
    const wantPct = totalExpense > 0 ? Math.round((totals.want / totalExpense) * 100) : 0;
    const savePct = totalExpense > 0 ? Math.round((totals.save / totalExpense) * 100) : 0;

    return { totals, lists, needPct, wantPct, savePct };
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
    const lists: Record<keyof JarTargets, Transaction[]> = {
      nec: [],
      ffa: [],
      educ: [],
      play: [],
      give: [],
      lts: [],
    };

    expenseTransactions.forEach(tx => {
      const targetJar = classifyJar(tx, categoryMap);
      if (!targetJar) return; // Cho vay / tạm ứng: trung tính, không thuộc hũ nào
      sums[targetJar] += tx.amount;
      lists[targetJar].push(tx);
    });

    const buildJarDetails = (key: keyof JarTargets) => {
      const sorted = [...lists[key]].sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.amount - a.amount;
      });
      const catSumMap: Record<string, number> = {};
      sorted.forEach(tx => {
        const ck = canonicalCategoryKey(tx.cat);
        catSumMap[ck] = (catSumMap[ck] || 0) + tx.amount;
      });
      const categoryBreakdown = Object.entries(catSumMap)
        .map(([catKey, amount]) => ({
          catKey,
          name: categoryMap[catKey]?.name || 'Khác',
          amount,
        }))
        .sort((a, b) => b.amount - a.amount);
      return { transactions: sorted, categoryBreakdown };
    };

    // Hoàn tiền / voucher được cộng trả lại hũ NEC (không phải thu nhập mới)
    data.records.forEach(r => {
      if (r.type === 'in' && plus.cashbackToNec[r.id] && isInPeriod(r.date)) sums.nec -= plus.cashbackToNec[r.id];
    });
    sums.nec = Math.max(0, sums.nec);

    // Ngân sách trần theo THU NHẬP ĐỊNH MỨC tháng (không phụ thuộc tổng chi thực tế)
    const baseDenominator = Math.max(0, plus.monthlyIncome || 0);

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
      transactions: Transaction[];
      categoryBreakdown: Array<{ catKey: string; name: string; amount: number }>;
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
        ...buildJarDetails('nec'),
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
        ...buildJarDetails('ffa'),
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
        ...buildJarDetails('educ'),
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
        ...buildJarDetails('play'),
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
        ...buildJarDetails('give'),
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
        ...buildJarDetails('lts'),
      },
    ];

    return {
      jars: jars.map(j => {
        const budget = j.targetAmount;
        const spent = Math.max(0, j.actual);
        const remaining = budget - spent;
        // % mục tiêu = 0% mà có chi → coi như vượt trần
        const usedPct = budget > 0 ? (spent / budget) * 100 : spent > 0 ? Infinity : 0;
        return { ...j, actual: spent, budget, remaining, usedPct };
      }),
      baseDenominator,
    };
  }, [expenseTransactions, categoryMap, jarTargets, data.records, plus.monthlyIncome, plus.cashbackToNec, isInPeriod]);

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
  const monthDisplay = periodRange.label;
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
                              <button
                                key={tx.id || idx}
                                type="button"
                                onClick={() => setEditingTx(tx)}
                                className="w-full text-left py-2.5 px-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <CategoryIcon catKey={tx.cat} size="sm" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {tx.note || cat?.name || 'Chi tiêu'}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                      <span>{formatDateVietnamese(tx.date)}</span>
                                      {cat?.name && (
                                        <>
                                          <span>·</span>
                                          <span className="truncate">{cat.name}</span>
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
                              </button>
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
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {reportType === 'out' ? 'Xếp Hạng Danh Mục Chi Tiêu' : 'Xếp Hạng Danh Mục Thu Nhập'} ({categoryStats.length})
                </h3>
                <span className="text-[11px] text-slate-400 shrink-0">Chạm để xem chi tiết</span>
              </div>

              <div className="space-y-2.5">
                {categoryStats.map(item => {
                  const isExpanded = expandedCategoryKey === item.catKey;
                  return (
                    <div
                      key={item.catKey}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        isExpanded
                          ? 'border-emerald-300 dark:border-emerald-700 bg-slate-50/60 dark:bg-slate-800/40'
                          : 'border-slate-100 dark:border-slate-800/80 bg-transparent hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCategoryKey(prev => (prev === item.catKey ? null : item.catKey))
                        }
                        className="w-full text-left p-2.5 space-y-1.5 cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <CategoryIcon catKey={item.catKey} size="sm" />
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                                {item.cat.name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {item.transactions.length} khoản
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 font-bold shrink-0 tabular-nums">
                            <span className="text-slate-400 text-xs">{Math.round(item.percentage)}%</span>
                            <span className="money-mask text-slate-900 dark:text-white">
                              {formatVND(item.amount)}
                            </span>
                            <span className="text-slate-400">
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, item.percentage)}%`, backgroundColor: item.cat.color }}
                          />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                          <div className="divide-y divide-slate-200/60 dark:divide-slate-700/60 max-h-64 overflow-y-auto pr-0.5">
                            {item.transactions.map(tx => {
                              const paySource = getPaySourceLabel(tx.accountId);
                              return (
                                <button
                                  key={tx.id}
                                  type="button"
                                  onClick={() => setEditingTx(tx)}
                                  className="w-full text-left py-2 px-1.5 -mx-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-2.5 cursor-pointer"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {tx.note || item.cat.name}
                                    </p>
                                    <p className="text-[11px] text-slate-400 truncate">
                                      {formatDateVietnamese(tx.date)}
                                      {paySource ? ` · ${paySource}` : ''}
                                    </p>
                                  </div>
                                  <span
                                    className={`money-mask text-xs sm:text-sm font-bold tabular-nums shrink-0 ${
                                      reportType === 'in'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-500'
                                    }`}
                                  >
                                    {reportType === 'in' ? '+' : '-'}
                                    {formatVND(tx.amount)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
            Mô hình phân bổ chi tiêu chuẩn quốc tế giúp bạn cân bằng cuộc sống và gia tăng tài sản dài hạn. Chạm từng nhóm để xem chi tiết các khoản chi.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {(
              [
                {
                  key: 'need' as const,
                  title: 'Thiết Yếu (Need)',
                  pct: rule503020.needPct,
                  target: 50,
                  total: rule503020.totals.need,
                  desc: 'Ăn uống, nhà ở, điện nước, đi lại',
                  cardBg: 'bg-amber-50/70 dark:bg-amber-950/30',
                  border: 'border-amber-200/80 dark:border-amber-800/50',
                  activeRing: 'ring-2 ring-amber-400/70',
                  titleCls: 'text-amber-800 dark:text-amber-300',
                  valCls: 'text-amber-950 dark:text-amber-200',
                  descCls: 'text-amber-700/80 dark:text-amber-400',
                },
                {
                  key: 'want' as const,
                  title: 'Cá Nhân (Want)',
                  pct: rule503020.wantPct,
                  target: 30,
                  total: rule503020.totals.want,
                  desc: 'Mua sắm, cà phê, du lịch, giải trí',
                  cardBg: 'bg-purple-50/70 dark:bg-purple-950/30',
                  border: 'border-purple-200/80 dark:border-purple-800/50',
                  activeRing: 'ring-2 ring-purple-400/70',
                  titleCls: 'text-purple-800 dark:text-purple-300',
                  valCls: 'text-purple-950 dark:text-purple-200',
                  descCls: 'text-purple-700/80 dark:text-purple-400',
                },
                {
                  key: 'save' as const,
                  title: 'Tích Lũy (Save)',
                  pct: rule503020.savePct,
                  target: 20,
                  total: rule503020.totals.save,
                  desc: 'Đầu tư, trả góp, gửi tiết kiệm',
                  cardBg: 'bg-emerald-50/70 dark:bg-emerald-950/30',
                  border: 'border-emerald-200/80 dark:border-emerald-800/50',
                  activeRing: 'ring-2 ring-emerald-400/70',
                  titleCls: 'text-emerald-800 dark:text-emerald-300',
                  valCls: 'text-emerald-950 dark:text-emerald-200',
                  descCls: 'text-emerald-700/80 dark:text-emerald-400',
                },
              ]
            ).map(grp => {
              const isSelected = expandedRuleGroup === grp.key;
              const count = rule503020.lists[grp.key].length;
              return (
                <button
                  key={grp.key}
                  type="button"
                  onClick={() => setExpandedRuleGroup(prev => (prev === grp.key ? null : grp.key))}
                  className={`text-left p-3.5 rounded-2xl border space-y-1 transition-all cursor-pointer ${grp.cardBg} ${grp.border} ${
                    isSelected ? grp.activeRing : 'hover:brightness-[0.98]'
                  }`}
                >
                  <div className={`flex items-center justify-between text-xs font-bold ${grp.titleCls}`}>
                    <span>{grp.title}</span>
                    <span>
                      {grp.pct}% / {grp.target}%
                    </span>
                  </div>
                  <p className={`text-base font-extrabold money-mask tabular-nums ${grp.valCls}`}>
                    {formatVND(grp.total)}
                  </p>
                  <div className={`flex items-center justify-between gap-2 text-[11px] ${grp.descCls}`}>
                    <span className="truncate">{grp.desc}</span>
                    <span className="shrink-0 font-bold flex items-center gap-0.5">
                      {count} khoản
                      {isSelected ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {expandedRuleGroup && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Chi tiết nhóm{' '}
                  {expandedRuleGroup === 'need'
                    ? 'Thiết Yếu (Need)'
                    : expandedRuleGroup === 'want'
                    ? 'Cá Nhân (Want)'
                    : 'Tích Lũy (Save)'}{' '}
                  · {monthDisplay}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {rule503020.lists[expandedRuleGroup].length} khoản
                </span>
              </div>

              {rule503020.lists[expandedRuleGroup].length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Chưa có khoản chi nào trong nhóm này ở {monthDisplay}.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 max-h-72 overflow-y-auto pr-1">
                  {rule503020.lists[expandedRuleGroup].map(tx => {
                    const cat = categoryMap[tx.cat];
                    const paySource = getPaySourceLabel(tx.accountId);
                    return (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => setEditingTx(tx)}
                        className="w-full text-left py-2.5 px-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-2.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CategoryIcon catKey={tx.cat} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {tx.note || cat?.name || 'Chi tiêu'}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {formatDateVietnamese(tx.date)}
                              {cat?.name ? ` · ${cat.name}` : ''}
                              {paySource ? ` · ${paySource}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="money-mask font-bold text-xs sm:text-sm text-rose-500 tabular-nums shrink-0">
                          -{formatVND(tx.amount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ngân sách theo thu nhập định mức:{' '}
                    <strong className="money-mask text-slate-700 dark:text-slate-200">
                      {formatVNDShort(sixJarsReport.baseDenominator)}
                    </strong>
                    /tháng
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingJars(true)}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <SlidersHorizontal size={13} />
                <span>Thiết lập %</span>
              </button>
            </div>

            <JarSettingsModal isOpen={isEditingJars} onClose={() => setIsEditingJars(false)} />

            {/* 6 Jars Bars Overview */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
              <span>Chạm vào từng hũ để xem các khoản chi trong {monthDisplay}</span>
            </div>

            <div className="space-y-3">
              {sixJarsReport.jars.map(jar => {
                const isOver = jar.remaining < 0 || jar.usedPct > 100;
                const isNear = !isOver && jar.usedPct >= 80;
                const barColor = isOver ? '#F43F5E' : isNear ? '#F59E0B' : jar.color;
                const barWidth = Math.min(100, Number.isFinite(jar.usedPct) ? jar.usedPct : 100);
                const isExpanded = expandedJarKey === jar.key;
                return (
                  <div
                    key={jar.key}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isExpanded
                        ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 shadow-xs'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedJarKey(prev => (prev === jar.key ? null : jar.key))}
                      aria-expanded={isExpanded}
                      className="w-full text-left p-3.5 space-y-2 cursor-pointer"
                    >
                      {/* Dòng 1: Mã hũ + tên đầy đủ + số khoản | Số tiền đã chi */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-black text-white shrink-0"
                            style={{ backgroundColor: jar.color }}
                          >
                            {jar.code}
                          </span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
                            {jar.label}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                            ({jar.transactions.length} khoản)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="money-mask text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                            {formatVND(jar.actual)}
                          </span>
                          <span className="text-slate-400">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </div>
                      </div>

                      {/* Dòng 2: Thanh % sử dụng ngân sách */}
                      <div
                        className="h-2.5 w-full bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={Number.isFinite(jar.usedPct) ? Math.round(jar.usedPct) : 100}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                        />
                      </div>

                      {/* Dòng 3: Ngân sách | Còn lại / Vượt trần */}
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] sm:text-xs tabular-nums">
                        <span className="text-slate-500 dark:text-slate-400">
                          Ngân sách: <span className="money-mask">{formatVND(jar.budget)}</span> ({jar.targetPct}%)
                        </span>
                        {isOver ? (
                          <strong className="money-mask text-rose-600 dark:text-rose-400">
                            Vượt trần: {formatVND(Math.abs(jar.remaining))}
                          </strong>
                        ) : (
                          <strong className="money-mask text-green-600 dark:text-green-400">
                            Còn lại: {formatVND(jar.remaining)}
                          </strong>
                        )}
                      </div>
                    </button>

                    {/* Expanded Monthly Transactions List for this Jar */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Chi tiết {jar.code} · {monthDisplay}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Chạm khoản chi để sửa
                          </span>
                        </div>

                        {jar.categoryBreakdown.length > 1 && (
                          <div className="flex flex-wrap gap-1.5">
                            {jar.categoryBreakdown.map(cb => (
                              <span
                                key={cb.catKey}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300"
                              >
                                <span className="font-semibold">{cb.name}:</span>
                                <span className="money-mask font-bold text-slate-900 dark:text-white tabular-nums">
                                  {formatVNDShort(cb.amount)}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}

                        {jar.transactions.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">
                            Chưa có khoản chi nào thuộc hũ {jar.code} trong {monthDisplay}.
                          </p>
                        ) : (
                          <div className="divide-y divide-slate-200/60 dark:divide-slate-800 max-h-72 overflow-y-auto pr-0.5">
                            {jar.transactions.map(tx => {
                              const cat = categoryMap[tx.cat];
                              const paySource = getPaySourceLabel(tx.accountId);
                              return (
                                <button
                                  key={tx.id}
                                  type="button"
                                  onClick={() => setEditingTx(tx)}
                                  className="w-full text-left py-2.5 px-1.5 -mx-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-2.5 cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <CategoryIcon catKey={tx.cat} size="sm" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                        {tx.note || cat?.name || 'Chi tiêu'}
                                      </p>
                                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                                        <span>{formatDateVietnamese(tx.date)}</span>
                                        {cat?.name && (
                                          <>
                                            <span>·</span>
                                            <span className="truncate">{cat.name}</span>
                                          </>
                                        )}
                                        {paySource && (
                                          <>
                                            <span>·</span>
                                            <span className="truncate">{paySource}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <span className="money-mask font-bold text-xs sm:text-sm text-rose-500 tabular-nums shrink-0">
                                    -{formatVND(tx.amount)}
                                  </span>
                                </button>
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
        </div>
      )}

      <EditTransactionModal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        transaction={editingTx}
      />
    </div>
  );
};
