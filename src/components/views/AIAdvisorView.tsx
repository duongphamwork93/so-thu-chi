import React, { useState } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Bot,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  ArrowRight,
  FileText,
  DollarSign,
  Calendar,
  Store,
  RefreshCw,
  Plus,
  Image as ImageIcon,
  Check,
  HelpCircle,
  Edit3,
  Wallet,
  Tag,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFinance } from '../../context/FinanceContext';
import { CATEGORY_MAP, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../constants/categories';
import { calculateNetWorthBreakdown, formatVND, getTodayDateString } from '../../utils/formatters';
import { compressImage } from '../../utils/imageCompressor';
import { resolveDefaultPaymentAccountId } from '../../utils/paymentMatcher';
import { BeneficiaryKey } from '../../types/finance';
import { getBeneficiaries } from '../../constants/beneficiaries';
import { CategoryIcon } from '../CategoryIcon';

export const AIAdvisorView: React.FC = () => {
  const { data, currentMonth, setCurrentMonth, addTransaction, allExpenseCategories, allIncomeCategories } = useFinance();

  const beneficiariesList = React.useMemo(
    () => getBeneficiaries(data.settings.memberNames, data.settings.customMembers),
    [data.settings.memberNames, data.settings.customMembers]
  );

  // Tab mode: 'receipt' | 'advisor' | 'quick'
  const [subTab, setSubTab] = useState<'receipt' | 'advisor' | 'quick'>('receipt');

  // 1. Receipt scanner state (supports 1 or multiple images in 1 batch)
  interface QueuedReceiptImage {
    id: string;
    name: string;
    base64: string;
    origSize: string;
    compSize: string;
    status: 'pending' | 'scanning' | 'done' | 'error';
    extractedCount?: number;
    errorMsg?: string;
  }

  const [selectedImages, setSelectedImages] = useState<QueuedReceiptImage[]>([]);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasSavedReceipt, setHasSavedReceipt] = useState<boolean>(false);
  const [savedBatchCount, setSavedBatchCount] = useState<number>(0);
  const [showReceiptItems, setShowReceiptItems] = useState<boolean>(false);
  const [scannedItems, setScannedItems] = useState<Array<{
    id: string;
    sourceImageId?: string;
    sourceImageLabel?: string;
    merchant: string;
    amount: number;
    type: 'in' | 'out';
    category: string;
    date: string;
    accountId: string;
    note: string;
    beneficiary?: BeneficiaryKey;
    selected: boolean;
  }>>([]);
  const [receiptForm, setReceiptForm] = useState<{
    merchant: string;
    amount: number;
    type: 'in' | 'out';
    category: string;
    date: string;
    accountId: string;
    note: string;
    beneficiary?: BeneficiaryKey;
  } | null>(null);

  // 2. Financial Advisor state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [adviceResult, setAdviceResult] = useState<any | null>(null);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  // 3. Quick text state
  const [quickInput, setQuickInput] = useState<string>('');
  const [quickResult, setQuickResult] = useState<any | null>(null);
  const [isQuickProcessing, setIsQuickProcessing] = useState<boolean>(false);
  const [hasSavedQuick, setHasSavedQuick] = useState<boolean>(false);
  const [quickForm, setQuickForm] = useState<{
    merchant: string;
    amount: number;
    type: 'in' | 'out';
    category: string;
    date: string;
    accountId: string;
    note: string;
    beneficiary?: BeneficiaryKey;
  } | null>(null);

  // Format file size nicely
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Validate a category key belongs to the selected transaction type
  const resolveValidCategory = (catKey: string | undefined, txType: 'in' | 'out'): string => {
    const list = txType === 'out' ? allExpenseCategories : allIncomeCategories;
    if (catKey && list.some(c => c.key === catKey)) return catKey;
    return txType === 'out' ? 'an_uong' : 'thu_khac';
  };

  // Dynamically group ALL built-in + custom categories by their real section (prevents empty optgroups)
  const renderCategoryOptions = (txType: 'in' | 'out') => {
    const list = txType === 'out' ? allExpenseCategories : allIncomeCategories;
    const builtInSet = new Set(
      (txType === 'out' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(c => c.key)
    );
    const builtInItems = list.filter(c => builtInSet.has(c.key));
    const customItems = list.filter(c => !builtInSet.has(c.key));

    const sections: string[] = [];
    builtInItems.forEach(c => {
      const sec = c.section || (txType === 'out' ? 'Khác' : 'Thu nhập');
      if (!sections.includes(sec)) sections.push(sec);
    });

    return (
      <>
        {sections.map(sec => (
          <optgroup key={sec} label={sec}>
            {builtInItems
              .filter(c => (c.section || (txType === 'out' ? 'Khác' : 'Thu nhập')) === sec)
              .map(c => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
          </optgroup>
        ))}
        {customItems.length > 0 && (
          <optgroup label="Danh mục bạn tự thêm">
            {customItems.map(c => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </optgroup>
        )}
      </>
    );
  };

  const resetReceiptScanner = () => {
    setSelectedImages([]);
    setScanProgress(null);
    setScanResult(null);
    setReceiptForm(null);
    setScannedItems([]);
    setScanError(null);
    setHasSavedReceipt(false);
    setSavedBatchCount(0);
    setShowReceiptItems(false);
  };

  // Handle single or multiple image uploads / camera with client-side compression
  const handleImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // If user already completed a scan & save cycle, start fresh on new uploads
    const shouldStartFresh = hasSavedReceipt || savedBatchCount > 0;
    if (shouldStartFresh) {
      setSelectedImages([]);
      setScannedItems([]);
      setReceiptForm(null);
      setScanResult(null);
      setSavedBatchCount(0);
      setHasSavedReceipt(false);
    }

    setScanError(null);
    setScanProgress(null);
    setIsCompressing(true);

    const readFileFallback = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Không đọc được ảnh'));
        reader.readAsDataURL(file);
      });

    try {
      const MAX_IMAGES = 15;
      const existingCount = shouldStartFresh ? 0 : selectedImages.length;
      const remainingSlots = Math.max(0, MAX_IMAGES - existingCount);
      const filesToProcess = files.slice(0, remainingSlots);

      if (files.length > remainingSlots) {
        setScanError(`Mỗi lượt quét tối đa ${MAX_IMAGES} ảnh để đảm bảo tốc độ ổn định. Đã thêm ${filesToProcess.length} ảnh đầu tiên.`);
      }

      const newQueued: QueuedReceiptImage[] = [];
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const origSize = formatBytes(file.size);
        let base64 = '';
        let compSize = origSize;
        try {
          const compressed = await compressImage(file, 960, 0.65);
          base64 = compressed.base64;
          const compSizeBytes = Math.round((compressed.base64.length * 3) / 4);
          compSize = formatBytes(compSizeBytes);
        } catch (err) {
          console.error('Image compression error:', err);
          base64 = await readFileFallback(file);
        }

        newQueued.push({
          id: `img_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name || `Ảnh #${existingCount + i + 1}`,
          base64,
          origSize,
          compSize,
          status: 'pending',
        });
      }

      setSelectedImages(prev => (shouldStartFresh ? newQueued : [...prev, ...newQueued]));
      if (newQueued.length > 0 && receiptForm) {
        // Switching from single receipt form to multi-image queue if adding more images
        setReceiptForm(null);
      }
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  // Scan a single queued image via API and return parsed raw data + mapped items
  const scanSingleQueuedImage = async (img: QueuedReceiptImage, imageLabel: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch('/api/gemini/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: img.base64,
          mimeType: 'image/jpeg',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        if (res.status === 413) {
          throw new Error('Dung lượng ảnh quá lớn với máy chủ. Vui lòng thử chọn ảnh nhỏ hơn.');
        } else if (res.status === 404) {
          throw new Error('Không tìm thấy API nhận diện. Nếu dùng Vercel, hãy đảm bảo đã deploy cả thư mục api/.');
        } else {
          throw new Error(`Máy chủ phản hồi mã lỗi ${res.status}. Vui lòng thử lại.`);
        }
      }

      if (!res.ok || !json.success) {
        if (json?.error?.includes('GEMINI_API_KEY')) {
          throw new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ (Vào Vercel > Settings > Environment Variables để thêm).');
        }
        throw new Error(json.error || 'Không thể bóc tách dữ liệu từ hình ảnh này.');
      }

      const raw = json.data || {};
      const rawList: any[] = Array.isArray(raw.transactions) && raw.transactions.length > 0
        ? raw.transactions
        : (raw.amount ? [raw] : []);

      const mapped = rawList.map((t, idx) => {
        const isInc = t.type === 'in';
        const txType = isInc ? ('in' as const) : ('out' as const);
        const safeCategory = resolveValidCategory(t.category, txType);
        const isChildCat = ['con_sua_bim', 'giao_duc', 'con_sach_vo', 'con_do_dung', 'con_y_te', 'con_tieu_vat'].includes(safeCategory);
        const resolvedAcc = resolveDefaultPaymentAccountId({
          type: txType,
          text: `${t.merchant || ''} ${t.note || ''}`,
          data,
        });
        return {
          id: `scan_${Date.now()}_${img.id.slice(-4)}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          sourceImageId: img.id,
          sourceImageLabel: imageLabel,
          merchant: t.merchant || 'Hóa đơn / Giao dịch',
          amount: Number(t.amount) || 0,
          type: txType,
          category: safeCategory,
          date: t.date || new Date().toISOString().slice(0, 10),
          accountId: resolvedAcc.accountId,
          note: t.note || '',
          beneficiary: (isInc ? undefined : (isChildCat ? 'both_children' : 'family')) as BeneficiaryKey | undefined,
          selected: true,
        };
      });

      return { raw, mapped };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Quét quá thời gian dự kiến (mạng chậm hoặc ảnh phức tạp).');
      }
      if (err.message === 'Load failed' || err.message === 'Failed to fetch') {
        throw new Error(
          'Lỗi kết nối máy chủ ("Load failed"). Nếu bạn đã đưa lên Vercel, hãy kiểm tra xem đã thêm GEMINI_API_KEY vào Project Settings > Environment Variables chưa.'
        );
      }
      throw err;
    }
  };

  // Perform AI scan on 1 or multiple receipt images (runs concurrency 2 for speed & Vercel safety)
  const handleScanReceipts = async (onlyTargetIds?: string[]) => {
    if (selectedImages.length === 0) return;

    const pendingOrError = selectedImages.filter(img => img.status === 'pending' || img.status === 'error');
    const targets = onlyTargetIds
      ? selectedImages.filter(img => onlyTargetIds.includes(img.id))
      : pendingOrError.length > 0
      ? pendingOrError
      : selectedImages; // Rescan all if everything was already done

    if (targets.length === 0) return;

    const isFullRescan = targets.length === selectedImages.length && pendingOrError.length === 0;
    const targetIdSet = new Set(targets.map(t => t.id));

    setIsScanning(true);
    setScanError(null);
    setHasSavedReceipt(false);
    setSavedBatchCount(0);
    setScanProgress({ done: 0, total: targets.length });

    if (isFullRescan) {
      setScannedItems([]);
      setReceiptForm(null);
      setScanResult(null);
    } else {
      // Remove any stale items belonging to images being retried
      setScannedItems(prev => prev.filter(it => !it.sourceImageId || !targetIdSet.has(it.sourceImageId)));
    }

    setSelectedImages(prev =>
      prev.map(img =>
        targetIdSet.has(img.id) ? { ...img, status: 'pending', errorMsg: undefined } : img
      )
    );

    const allNewItems: typeof scannedItems = [];
    let lastSingleRaw: any = null;
    let firstErrorMsg: string | null = null;
    let completedCount = 0;

    // Preserve display index (Ảnh #1, Ảnh #2...) matching selectedImages order
    const indexById = new Map<string, number>();
    selectedImages.forEach((img, idx) => indexById.set(img.id, idx + 1));

    const queue = [...targets];
    const workerCount = Math.min(2, queue.length);

    const runWorker = async () => {
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;

        const imgNum = indexById.get(current.id) || 1;
        const label = `Ảnh #${imgNum}`;

        setSelectedImages(prev =>
          prev.map(img => (img.id === current.id ? { ...img, status: 'scanning', errorMsg: undefined } : img))
        );

        try {
          const { raw, mapped } = await scanSingleQueuedImage(current, label);
          lastSingleRaw = raw;
          allNewItems.push(...mapped);

          setSelectedImages(prev =>
            prev.map(img =>
              img.id === current.id
                ? { ...img, status: 'done', extractedCount: mapped.length, errorMsg: undefined }
                : img
            )
          );
        } catch (err: any) {
          const msg = err?.message || 'Lỗi khi phân tích ảnh';
          if (!firstErrorMsg) firstErrorMsg = `${label}: ${msg}`;
          setSelectedImages(prev =>
            prev.map(img =>
              img.id === current.id
                ? { ...img, status: 'error', extractedCount: 0, errorMsg: msg }
                : img
            )
          );
        } finally {
          completedCount += 1;
          setScanProgress({ done: completedCount, total: targets.length });
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    const existingKeptItems = isFullRescan
      ? []
      : scannedItems.filter(it => !it.sourceImageId || !targetIdSet.has(it.sourceImageId));
    const combinedItems = [...existingKeptItems, ...allNewItems];

    setScannedItems(combinedItems);

    if (selectedImages.length === 1 && combinedItems.length === 1 && lastSingleRaw) {
      setScanResult(lastSingleRaw);
      setReceiptForm(combinedItems[0]);
    } else {
      setScanResult(null);
      setReceiptForm(null);
    }

    if (firstErrorMsg && allNewItems.length === 0) {
      setScanError(firstErrorMsg);
    } else if (firstErrorMsg) {
      setScanError(`Một số ảnh chưa quét được (${firstErrorMsg}). Bạn có thể bấm "Quét lại" trên ảnh bị lỗi.`);
    }

    if (allNewItems.length > 0) {
      confetti({ particleCount: Math.min(100, 40 + allNewItems.length * 12), spread: 65, origin: { y: 0.7 } });
    }

    setIsScanning(false);
    setScanProgress(null);
  };

  // Save single scanned receipt as transaction
  const handleSaveScannedReceipt = () => {
    if (!receiptForm) return;
    const txDate = receiptForm.date || getTodayDateString();
    addTransaction({
      type: receiptForm.type,
      cat: receiptForm.category || (receiptForm.type === 'in' ? 'luong' : 'an_uong'),
      amount: Number(receiptForm.amount) || 0,
      date: txDate,
      note: `${receiptForm.merchant}${receiptForm.note ? ` - ${receiptForm.note}` : ''}`.trim(),
      accountId: receiptForm.accountId || undefined,
      beneficiary: receiptForm.type === 'out' ? (receiptForm.beneficiary || 'family') : undefined,
    });

    // Auto-switch currentMonth to match transaction date so it shows immediately in Sổ Thu Chi
    const targetMonth = txDate.slice(0, 7);
    if (targetMonth && targetMonth !== currentMonth) {
      setCurrentMonth(targetMonth);
    }

    setHasSavedReceipt(true);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  };

  // Batch save multiple scanned transactions
  const handleSaveAllSelectedScanned = () => {
    const selected = scannedItems.filter(item => item.selected && item.amount > 0);
    if (selected.length === 0) return;

    let targetMonth = '';
    selected.forEach(item => {
      const txDate = item.date || getTodayDateString();
      targetMonth = txDate.slice(0, 7);
      addTransaction({
        type: item.type,
        cat: item.category || (item.type === 'in' ? 'luong' : 'an_uong'),
        amount: Number(item.amount) || 0,
        date: txDate,
        note: `${item.merchant}${item.note ? ` - ${item.note}` : ''}`.trim(),
        accountId: item.accountId || undefined,
        beneficiary: item.type === 'out' ? (item.beneficiary || 'family') : undefined,
      });
    });

    // Auto-switch currentMonth to match transactions so user immediately sees them in Sổ Thu Chi!
    if (targetMonth && targetMonth !== currentMonth) {
      setCurrentMonth(targetMonth);
    }

    setSavedBatchCount(selected.length);
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
  };

  // Run AI Financial Advisor
  const handleGenerateAdvice = async () => {
    setIsAnalyzing(true);
    setAdviceError(null);

    const monthRecords = data.records.filter(r => r.date?.startsWith(currentMonth));
    const income = monthRecords.filter(r => r.type === 'in').reduce((s, r) => s + r.amount, 0);
    const expense = monthRecords.filter(r => r.type === 'out').reduce((s, r) => s + r.amount, 0);
    const byCategory: Record<string, number> = {};
    monthRecords.filter(r => r.type === 'out').forEach(r => {
      byCategory[r.cat] = (byCategory[r.cat] || 0) + r.amount;
    });

    const nw = calculateNetWorthBreakdown(data);

    try {
      const res = await fetch('/api/gemini/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentMonth,
          income,
          expense,
          budget: data.settings.budget,
          byCategory,
          netWorth: nw.netWorth,
          debts: nw.totalLiabilities,
          savings: nw.depositsTotal + nw.investmentsTotal,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể tạo phân tích tài chính');
      }

      setAdviceResult(json.data);
    } catch (err: any) {
      setAdviceError(err.message || 'Lỗi khi tạo lời khuyên tài chính');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle quick text AI parse
  const handleQuickTextParse = async () => {
    if (!quickInput.trim()) return;
    setIsQuickProcessing(true);

    try {
      const res = await fetch('/api/gemini/quick-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: quickInput }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const raw = json.data || {};
        const isIncome = raw.type === 'in';
        const defaultCat = raw.category || (isIncome ? 'thu_khac' : 'an_uong');
        let detectedBeneficiary: BeneficiaryKey = 'family';
        const lower = quickInput.toLowerCase();
        const matchedCustom = (data.settings.customMembers || []).find(
          m => m.name && lower.includes(m.name.toLowerCase())
        );
        if (matchedCustom) {
          detectedBeneficiary = matchedCustom.id;
        } else if (
          lower.includes('con 1') ||
          lower.includes('bé 1') ||
          (data.settings.memberNames?.child1 && lower.includes(data.settings.memberNames.child1.toLowerCase()))
        ) {
          detectedBeneficiary = 'child1';
        } else if (
          lower.includes('con 2') ||
          lower.includes('bé 2') ||
          (data.settings.memberNames?.child2 && lower.includes(data.settings.memberNames.child2.toLowerCase()))
        ) {
          detectedBeneficiary = 'child2';
        } else if (
          lower.includes('2 con') ||
          lower.includes('hai con') ||
          lower.includes('hai đứa') ||
          lower.includes('2 đứa') ||
          defaultCat === 'con_sua_bim' ||
          defaultCat === 'giao_duc' ||
          defaultCat === 'con_do_dung' ||
          defaultCat === 'con_y_te'
        ) {
          detectedBeneficiary = 'both_children';
        } else if (
          lower.includes('chồng') ||
          lower.includes('anh xã') ||
          lower.includes('cho bố') ||
          (data.settings.memberNames?.spouse && lower.includes(data.settings.memberNames.spouse.toLowerCase()))
        ) {
          detectedBeneficiary = 'spouse';
        } else if (
          lower.includes('cho tôi') ||
          lower.includes('cho mình') ||
          lower.includes('cho mẹ') ||
          (data.settings.memberNames?.me && lower.includes(data.settings.memberNames.me.toLowerCase()))
        ) {
          detectedBeneficiary = 'me';
        }

        setQuickResult(raw);
        const resolvedQuickAcc = resolveDefaultPaymentAccountId({
          type: isIncome ? 'in' : 'out',
          text: `${quickInput} ${raw.merchant || ''} ${raw.note || ''}`,
          data,
        });
        setQuickForm({
          merchant: raw.merchant || raw.note || 'Giao dịch bóc tách',
          amount: Number(raw.amount) || 0,
          type: isIncome ? 'in' : 'out',
          category: resolveValidCategory(defaultCat, isIncome ? 'in' : 'out'),
          date: raw.date || new Date().toISOString().slice(0, 10),
          accountId: resolvedQuickAcc.accountId,
          note: raw.note || '',
          beneficiary: isIncome ? undefined : detectedBeneficiary,
        });
        setHasSavedQuick(false);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsQuickProcessing(false);
    }
  };

  const handleSaveQuick = () => {
    if (!quickForm) return;
    const txDate = quickForm.date || getTodayDateString();
    addTransaction({
      type: quickForm.type,
      cat: quickForm.category || (quickForm.type === 'in' ? 'luong' : 'an_uong'),
      amount: Number(quickForm.amount) || 0,
      date: txDate,
      note: `${quickForm.merchant}${quickForm.note && quickForm.note !== quickForm.merchant ? ` - ${quickForm.note}` : ''}`.trim(),
      accountId: quickForm.accountId || undefined,
      beneficiary: quickForm.type === 'out' ? (quickForm.beneficiary || 'family') : undefined,
    });
    const targetMonth = txDate.slice(0, 7);
    if (targetMonth && targetMonth !== currentMonth) {
      setCurrentMonth(targetMonth);
    }
    setHasSavedQuick(true);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  };

  return (
    <div className="space-y-4 pb-24">
      {/* 1. Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-violet-100 via-indigo-50 to-emerald-50 dark:from-violet-950/60 dark:via-indigo-950/50 dark:to-slate-900 text-slate-900 dark:text-white p-5 shadow-sm border border-violet-200/80 dark:border-violet-800/50 space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-white/85 dark:bg-violet-600/40 border border-violet-200/80 dark:border-white/15 flex items-center justify-center shrink-0 shadow-2xs">
            <Bot size={20} className="text-violet-600 dark:text-violet-300" />
          </div>
          <h2 className="text-base sm:text-lg font-extrabold">Trợ Lý Tài Chính Thông Minh (AI)</h2>
        </div>
        <p className="text-xs sm:text-[13px] text-slate-600 dark:text-violet-200/90 leading-relaxed">
          Quét bóc tách hóa đơn siêu thị, biên lai chuyển khoản ngân hàng bằng hình ảnh hoặc nhận diện câu nói tiếng Việt tự nhiên.
        </p>
      </div>

      {/* 2. Sub Tabs */}
      <div className="grid grid-cols-3 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1.5">
        <button
          type="button"
          onClick={() => setSubTab('receipt')}
          className={`min-h-[44px] py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            subTab === 'receipt'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Camera size={16} className="shrink-0" />
          <span className="leading-tight">Quét Hóa Đơn</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('advisor')}
          className={`min-h-[44px] py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            subTab === 'advisor'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles size={16} className="shrink-0" />
          <span className="leading-tight">Phân Tích 50/30/20</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('quick')}
          className={`min-h-[44px] py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            subTab === 'quick'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText size={16} className="shrink-0" />
          <span className="leading-tight">Bóc Tách Văn Bản</span>
        </button>
      </div>

      {/* 3. SUBTAB 1: RECEIPT SCANNER */}
      {subTab === 'receipt' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="text-center space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Chụp Hoặc Tải Lên Ảnh Hóa Đơn
            </h3>
            <p className="text-xs text-slate-400">
              Hỗ trợ hóa đơn Co.opmart, WinMart, nhà hàng, cây xăng Petrolimex, biên lai VietinBank, VCB, MoMo...
            </p>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            {isCompressing ? (
              <div className="py-8 space-y-3">
                <RefreshCw size={28} className="animate-spin mx-auto text-violet-600" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Đang tối ưu hóa danh sách ảnh...
                </p>
                <p className="text-[11px] text-slate-400">Giảm kích thước file để quét nhiều ảnh siêu nhanh</p>
              </div>
            ) : selectedImages.length > 0 ? (
              <div className="space-y-4">
                {selectedImages.length === 1 ? (
                  <div className="relative inline-block max-w-full">
                    <img
                      src={selectedImages[0].base64}
                      alt={selectedImages[0].name}
                      className="max-h-64 mx-auto rounded-2xl shadow-md object-contain border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => resetReceiptScanner()}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-900/75 hover:bg-rose-600 text-white flex items-center justify-center shadow-sm cursor-pointer transition-colors"
                      title="Xóa ảnh này"
                    >
                      <X size={16} />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-slate-900/85 text-emerald-300 text-[10px] font-bold backdrop-blur-xs flex items-center gap-1 shadow-xs whitespace-nowrap">
                      <span>⚡ Đã nén: {selectedImages[0].origSize} ➔ {selectedImages[0].compSize}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        Đã chọn {selectedImages.length} ảnh để quét 1 lượt
                      </span>
                      <button
                        type="button"
                        onClick={resetReceiptScanner}
                        disabled={isScanning}
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 disabled:opacity-40 cursor-pointer"
                      >
                        Xóa tất cả
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto p-1">
                      {selectedImages.map((img, idx) => (
                        <div
                          key={img.id}
                          className={`relative rounded-2xl overflow-hidden border bg-slate-100 dark:bg-slate-800/80 aspect-[4/5] group ${
                            img.status === 'error'
                              ? 'border-rose-400 dark:border-rose-600'
                              : img.status === 'done'
                              ? 'border-emerald-400 dark:border-emerald-600'
                              : img.status === 'scanning'
                              ? 'border-violet-400 dark:border-violet-500 ring-2 ring-violet-400/30'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <img
                            src={img.base64}
                            alt={`Ảnh #${idx + 1}`}
                            className="w-full h-full object-cover"
                          />

                          {/* Top overlay: Index badge + Remove X */}
                          <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-900/75 text-white text-[10px] font-bold backdrop-blur-xs">
                              Ảnh #{idx + 1}
                            </span>
                            {!isScanning && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextImgs = selectedImages.filter(it => it.id !== img.id);
                                  setSelectedImages(nextImgs);
                                  setScannedItems(prev => prev.filter(it => it.sourceImageId !== img.id));
                                  if (nextImgs.length === 0) resetReceiptScanner();
                                }}
                                className="w-7 h-7 rounded-full bg-slate-900/75 hover:bg-rose-600 text-white flex items-center justify-center shadow-xs cursor-pointer transition-colors"
                                title={`Xóa Ảnh #${idx + 1}`}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {/* Bottom status pill */}
                          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                            {img.status === 'pending' && (
                              <span className="px-2 py-0.5 rounded-lg bg-slate-900/75 text-slate-200 text-[10px] font-semibold backdrop-blur-xs truncate">
                                Chờ quét ({img.compSize})
                              </span>
                            )}
                            {img.status === 'scanning' && (
                              <span className="px-2 py-0.5 rounded-lg bg-violet-600/90 text-white text-[10px] font-bold backdrop-blur-xs flex items-center gap-1">
                                <RefreshCw size={10} className="animate-spin" />
                                <span>Đang quét...</span>
                              </span>
                            )}
                            {img.status === 'done' && (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-600/90 text-white text-[10px] font-bold backdrop-blur-xs flex items-center gap-1">
                                <Check size={10} />
                                <span>{img.extractedCount || 0} khoản</span>
                              </span>
                            )}
                            {img.status === 'error' && (
                              <button
                                type="button"
                                onClick={() => handleScanReceipts([img.id])}
                                disabled={isScanning}
                                className="w-full px-2 py-1 rounded-lg bg-rose-600/95 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <RefreshCw size={10} />
                                <span>Lỗi • Quét lại</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <label className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-bold rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 cursor-pointer flex items-center gap-2 active:scale-95 transition-all">
                    <Camera size={16} />
                    <span>Chụp thêm</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleImagesChange} className="hidden" />
                  </label>

                  <label className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-bold rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 cursor-pointer flex items-center gap-2 active:scale-95 transition-all">
                    <ImageIcon size={16} />
                    <span>+ Thêm nhiều ảnh</span>
                    <input type="file" accept="image/*" multiple onChange={handleImagesChange} className="hidden" />
                  </label>

                  <button
                    type="button"
                    onClick={() => handleScanReceipts()}
                    disabled={isScanning}
                    className="w-full sm:w-auto min-h-[46px] px-5 py-2.5 text-sm font-bold rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>
                          {scanProgress
                            ? `Đang quét ${scanProgress.done}/${scanProgress.total} ảnh...`
                            : 'Đang phân tích siêu tốc...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>
                          {(() => {
                            const pendingCount = selectedImages.filter(i => i.status === 'pending' || i.status === 'error').length;
                            if (selectedImages.length === 1) {
                              return pendingCount > 0 ? 'Bắt đầu quét ngay' : 'Quét lại ảnh này';
                            }
                            return pendingCount > 0 && pendingCount < selectedImages.length
                              ? `Quét tiếp ${pendingCount} ảnh mới`
                              : pendingCount === 0
                              ? `Quét lại tất cả ${selectedImages.length} ảnh`
                              : `Quét Tất Cả ${selectedImages.length} Ảnh Ngay`;
                          })()}
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {isScanning && (
                  <div className="w-full max-w-md mx-auto p-3.5 rounded-2xl bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-center space-y-2">
                    <p className="text-xs font-bold text-violet-700 dark:text-violet-300 flex items-center justify-center gap-1.5">
                      <Sparkles size={14} className="animate-spin text-violet-500" />
                      <span>
                        {scanProgress && scanProgress.total > 1
                          ? `AI đang bóc tách đồng thời (${scanProgress.done}/${scanProgress.total} ảnh hoàn tất)...`
                          : 'AI đang bóc tách giao dịch từ ảnh...'}
                      </span>
                    </p>
                    {scanProgress && scanProgress.total > 1 && (
                      <div className="w-full h-2 rounded-full bg-violet-200/70 dark:bg-violet-900 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-300 rounded-full"
                          style={{ width: `${Math.round((scanProgress.done / scanProgress.total) * 100)}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Ảnh đã nén siêu nhẹ, kết quả sẽ gom đầy đủ vào bảng chỉnh sửa bên dưới!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto shadow-xs">
                  <Camera size={26} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Chụp hoặc tải 1 hoặc nhiều ảnh hóa đơn cùng lúc
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Chọn nhiều ảnh Shopee, chuyển khoản, hóa đơn siêu thị để AI quét 1 lần và gom thành danh sách duyệt
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-md mx-auto">
                  <label className="w-full sm:w-auto flex-1 min-h-[46px] px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 text-white text-sm font-bold rounded-2xl shadow-sm cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <Camera size={18} />
                    <span>Mở máy ảnh chụp</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleImagesChange} className="hidden" />
                  </label>

                  <label className="w-full sm:w-auto flex-1 min-h-[46px] px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <ImageIcon size={18} />
                    <span>Chọn nhiều ảnh từ album</span>
                    <input type="file" accept="image/*" multiple onChange={handleImagesChange} className="hidden" />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Error card with helpful advice */}
          {scanError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-800 dark:text-rose-200">Không thể hoàn tất quét hóa đơn</p>
                  <p className="leading-relaxed text-[11.5px]">{scanError}</p>
                </div>
              </div>

              {/* Step-by-step guidance if Vercel / API Key is the issue */}
              {(scanError.includes('Vercel') || scanError.includes('GEMINI_API_KEY') || scanError.includes('Load failed')) && (
                <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-rose-200/60 dark:border-rose-800/60 text-slate-700 dark:text-slate-300 space-y-1.5 text-[11px]">
                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    <HelpCircle size={13} className="text-violet-600" />
                    <span>Hướng dẫn cài đặt nhanh cho Vercel:</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400 pl-1">
                    <li>Đăng nhập <strong className="text-slate-800 dark:text-slate-200">vercel.com</strong> và chọn dự án <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">so-thu-chi</code></li>
                    <li>Vào mục <strong className="text-slate-800 dark:text-slate-200">Settings</strong> ➔ <strong className="text-slate-800 dark:text-slate-200">Environment Variables</strong></li>
                    <li>Tạo biến mới với Key: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] font-mono">GEMINI_API_KEY</code> và dán mã API Gemini của bạn vào</li>
                    <li>Vào tab <strong className="text-slate-800 dark:text-slate-200">Deployments</strong> ➔ chọn dấu ba chấm (...) ➔ bấm <strong className="text-slate-800 dark:text-slate-200">Redeploy</strong></li>
                  </ol>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleScanReceipts()}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-xl font-bold text-[11px] hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Thử quét lại</span>
                </button>
                <button
                  onClick={() => setSubTab('quick')}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-[11px] hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-1"
                >
                  <FileText size={12} />
                  <span>Nhập nhanh bằng lời nói/chữ</span>
                </button>
              </div>
            </div>
          )}

          {/* Multi-transaction Result Card (Also remains visible when deleted down to 1 item) */}
          {scannedItems.length > 0 && !receiptForm && (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-violet-200 dark:border-violet-900/60 shadow-md space-y-4 animate-in fade-in">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Danh sách {scannedItems.length} khoản giao dịch</span>
                    </h4>
                    <p className="text-[11px] sm:text-xs text-violet-600 dark:text-violet-400 font-medium">
                      AI đã bóc tách từng khoản • Bạn có thể sửa hoặc xóa riêng từng khoản
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScannedItems([]);
                    setSavedBatchCount(0);
                  }}
                  className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  title="Đóng / Hủy bỏ tất cả"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Master Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-violet-50/70 dark:bg-slate-800/80 border border-violet-100 dark:border-slate-700/60 text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = scannedItems.every(i => i.selected);
                    setScannedItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
                  }}
                  className="min-h-[40px] px-2.5 py-1.5 rounded-xl font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-100/70 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={scannedItems.every(i => i.selected)}
                    readOnly
                    className="w-5 h-5 rounded text-violet-600 focus:ring-0 cursor-pointer"
                  />
                  <span>
                    {scannedItems.every(i => i.selected) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'} ({scannedItems.filter(i => i.selected).length}/{scannedItems.length})
                  </span>
                </button>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayDateString();
                      setScannedItems(prev => prev.map(i => ({ ...i, date: today })));
                    }}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-slate-600 hover:bg-violet-100 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-2xs cursor-pointer"
                    title="Đặt tất cả các khoản về ngày hôm nay"
                  >
                    <Calendar size={14} />
                    <span>Đặt ngày hôm nay</span>
                  </button>

                  <div className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                    Tổng:{' '}
                    <span className="text-violet-600 dark:text-violet-400">
                      {formatVND(scannedItems.filter(i => i.selected).reduce((sum, i) => sum + (i.amount || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Cards List */}
              <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                {scannedItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all space-y-3 ${
                      item.selected
                        ? 'bg-white dark:bg-slate-800/90 border-violet-300 dark:border-violet-700/80 shadow-xs'
                        : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    {/* Item Top row: Checkbox, Index, Type Toggle, Delete */}
                    <div className="flex items-center justify-between gap-2">
                      <label className="min-h-[40px] flex items-center gap-2.5 pr-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={e => {
                            const checked = e.target.checked;
                            setScannedItems(prev => prev.map(it => it.id === item.id ? { ...it, selected: checked } : it));
                          }}
                          className="w-5 h-5 rounded text-violet-600 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                          <span>Khoản #{idx + 1}</span>
                          {item.sourceImageLabel && selectedImages.length > 1 && (
                            <span className="px-2 py-0.5 rounded-lg bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 text-[10px] font-bold">
                              {item.sourceImageLabel}
                            </span>
                          )}
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        {/* Segmented Type Toggle */}
                        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl gap-1 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setScannedItems(prev => prev.map(it => it.id === item.id ? {
                                ...it,
                                type: 'out',
                                category: resolveValidCategory(it.type === 'out' ? it.category : undefined, 'out'),
                              } : it));
                            }}
                            className={`min-h-[34px] px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                              item.type === 'out' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Chi (-)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setScannedItems(prev => prev.map(it => it.id === item.id ? {
                                ...it,
                                type: 'in',
                                category: resolveValidCategory(it.type === 'in' ? it.category : undefined, 'in'),
                              } : it));
                            }}
                            className={`min-h-[34px] px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                              item.type === 'in' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Thu (+)
                          </button>
                        </div>

                        {/* Delete ONLY this single item */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setScannedItems(prev => prev.filter(it => it.id !== item.id));
                          }}
                          className="w-9 h-9 rounded-xl bg-rose-50/90 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-500 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0"
                          title={`Xóa riêng Khoản #${idx + 1}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Amount & Merchant Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
                      <div className="space-y-1 min-w-0">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Số tiền (VNĐ)</label>
                        <input
                          type="number"
                          value={item.amount || ''}
                          onChange={e => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setScannedItems(prev => prev.map(it => it.id === item.id ? { ...it, amount: val } : it));
                          }}
                          className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                        />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Đối tác / Tên giao dịch</label>
                        <input
                          type="text"
                          value={item.merchant}
                          onChange={e => {
                            const val = e.target.value;
                            setScannedItems(prev => prev.map(it => it.id === item.id ? { ...it, merchant: val } : it));
                          }}
                          className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                        />
                      </div>
                    </div>

                    {/* Category, Wallet & Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0">
                      <div className="space-y-1 min-w-0">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Danh mục</label>
                        <div className="relative flex items-center">
                          <div className="absolute left-2.5 pointer-events-none">
                            <CategoryIcon catKey={item.category} size="sm" />
                          </div>
                          <select
                            value={resolveValidCategory(item.category, item.type)}
                            onChange={e => {
                              const val = e.target.value;
                              setScannedItems(prev => prev.map(it => it.id === item.id ? { ...it, category: val } : it));
                            }}
                            className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-8 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none appearance-none cursor-pointer truncate"
                          >
                            {renderCategoryOptions(item.type)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className="space-y-1 min-w-0">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Tài khoản / Thẻ trừ tiền</label>
                        <select
                          value={item.accountId}
                          onChange={e => {
                            const val = e.target.value;
                            setScannedItems(prev => prev.map(it => it.id === item.id ? { ...it, accountId: val } : it));
                          }}
                          className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer truncate"
                        >
                          <option value="">-- Không trừ ví/thẻ --</option>
                          <optgroup label="Ví & Tài khoản ngân hàng">
                            {data.accts.map(acc => (
                              <option key={acc.id} value={acc.id}>
                                🏦 {acc.name} ({formatVND(acc.balance)})
                              </option>
                            ))}
                          </optgroup>
                          {data.cards.length > 0 && (
                            <optgroup label="Thẻ tín dụng (Ghi nợ chi tiêu)">
                              {data.cards.map(card => (
                                <option key={card.id} value={card.id}>
                                  💳 {card.name} (Dư nợ: {formatVND(card.currentBalance)})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      <div className="space-y-1 min-w-0">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Ngày ghi</label>
                        <input
                          type="date"
                          value={item.date}
                          onChange={e => {
                            const val = e.target.value;
                            setScannedItems(prev => prev.map(it => it.id === item.id ? { ...it, date: val } : it));
                          }}
                          className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Note row */}
                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-bold text-slate-500 uppercase">Ghi chú lời nhắn</label>
                      <input
                        type="text"
                        value={item.note}
                        onChange={e => {
                          const val = e.target.value;
                          setScannedItems(prev => prev.map(it => it.id === item.id ? { ...it, note: val } : it));
                        }}
                        placeholder="Nội dung chuyển khoản hoặc mục đích..."
                        className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>

                    {/* Chi cho ai (Cá nhân & Con cái) */}
                    {item.type === 'out' && (
                      <div className="space-y-1 min-w-0 pt-0.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                          <span>Chi cho ai (Cá nhân / Con cái)</span>
                          {item.beneficiary === 'both_children' && (
                            <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">⚡ Chia đôi 50/50</span>
                          )}
                        </label>
                        <select
                          value={item.beneficiary || 'family'}
                          onChange={e => {
                            const val = e.target.value as BeneficiaryKey;
                            setScannedItems(prev => prev.map(it => it.id === item.id ? { ...it, beneficiary: val } : it));
                          }}
                          className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer truncate"
                        >
                          {beneficiariesList.map(b => (
                            <option key={b.key} value={b.key}>
                              {b.avatar} {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Master Save Actions */}
              <div className="pt-2 space-y-2.5">
                {savedBatchCount > 0 ? (
                  <div className="space-y-2.5">
                    <div className="w-full py-3.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center justify-center gap-2">
                      <CheckCircle2 size={18} />
                      <span>Đã lưu thành công {savedBatchCount} giao dịch vào Sổ Thu Chi!</span>
                    </div>
                    <button
                      type="button"
                      onClick={resetReceiptScanner}
                      className="w-full min-h-[46px] py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-2xl transition-all cursor-pointer"
                    >
                      Tiếp tục quét ảnh khác
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleSaveAllSelectedScanned}
                      disabled={scannedItems.filter(i => i.selected && i.amount > 0).length === 0}
                      className="flex-1 min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus size={18} />
                      <span>Lưu {scannedItems.filter(i => i.selected && i.amount > 0).length} Khoản Vào Sổ Thu Chi</span>
                    </button>
                    <button
                      type="button"
                      onClick={resetReceiptScanner}
                      className="min-h-[48px] px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm transition-all cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Single-transaction Result Card (When AI originally detected only 1 item into receiptForm) */}
          {receiptForm && (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-violet-200 dark:border-violet-900/60 shadow-md space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <Edit3 size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Xác Nhận & Chỉnh Sửa Giao Dịch
                    </h4>
                    <p className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                      AI đã bóc tách • Bạn có thể sửa mọi thông tin trước khi lưu
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScanResult(null);
                    setReceiptForm(null);
                    setScannedItems([]);
                    setHasSavedReceipt(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Đóng / Hủy bỏ"
                >
                  <X size={16} />
                </button>
              </div>

              {/* 1. Loại giao dịch (Chi tiêu vs Thu nhập) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Loại Giao Dịch
                </label>
                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptForm(prev => prev ? {
                        ...prev,
                        type: 'out',
                        category: prev.type === 'out' ? prev.category : 'an_uong'
                      } : null);
                    }}
                    className={`min-h-[42px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      receiptForm.type === 'out'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Chi tiền (Khoản chi)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptForm(prev => prev ? {
                        ...prev,
                        type: 'in',
                        category: prev.type === 'in' ? prev.category : 'thu_khac'
                      } : null);
                    }}
                    className={`min-h-[42px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      receiptForm.type === 'in'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Thu tiền (Khoản thu)
                  </button>
                </div>
              </div>

              {/* 2. Số tiền & Đơn vị tiền */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                  <span>Số Tiền (VNĐ)</span>
                  <span className="text-violet-600 dark:text-violet-400 font-bold">
                    {formatVND(receiptForm.amount)}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={receiptForm.amount || ''}
                    onChange={e => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setReceiptForm(prev => prev ? { ...prev, amount: val } : null);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    đ
                  </span>
                </div>
              </div>

              {/* 3. Tên giao dịch / Đơn vị */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Tên Giao Dịch / Cửa Hàng / Người Nhận
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={receiptForm.merchant}
                    onChange={e => {
                      const val = e.target.value;
                      setReceiptForm(prev => prev ? { ...prev, merchant: val } : null);
                    }}
                    placeholder="VD: Nhà hàng 1946, WinMart, Petrolimex..."
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
              </div>

              {/* 4. Danh mục chi tiêu & Tài khoản thanh toán */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                <div className="space-y-1.5 min-w-0">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Danh Mục
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-2.5 pointer-events-none">
                      <CategoryIcon catKey={resolveValidCategory(receiptForm.category, receiptForm.type)} size="sm" />
                    </div>
                    <select
                      value={resolveValidCategory(receiptForm.category, receiptForm.type)}
                      onChange={e => {
                        const val = e.target.value;
                        setReceiptForm(prev => prev ? { ...prev, category: val } : null);
                      }}
                      className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-8 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 appearance-none cursor-pointer truncate"
                    >
                      {renderCategoryOptions(receiptForm.type)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Tài Khoản / Thẻ Trừ Tiền
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 text-slate-400 pointer-events-none">
                      <Wallet size={15} />
                    </div>
                    <select
                      value={receiptForm.accountId}
                      onChange={e => {
                        const val = e.target.value;
                        setReceiptForm(prev => prev ? { ...prev, accountId: val } : null);
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 appearance-none cursor-pointer"
                    >
                      <option value="">-- Không trừ ví/thẻ --</option>
                      <optgroup label="Ví & Tài khoản ngân hàng">
                        {data.accts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            🏦 {acc.name} ({formatVND(acc.balance)})
                          </option>
                        ))}
                      </optgroup>
                      {data.cards.length > 0 && (
                        <optgroup label="Thẻ tín dụng (Ghi nợ chi tiêu)">
                          {data.cards.map(card => (
                            <option key={card.id} value={card.id}>
                              💳 {card.name} (Dư nợ: {formatVND(card.currentBalance)})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* 5. Ngày giao dịch & Ghi chú (Fixed overflow for iOS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Ngày Giao Dịch
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptForm(prev => prev ? { ...prev, date: getTodayDateString() } : null);
                      }}
                      className="text-[10px] text-violet-600 dark:text-violet-400 font-bold hover:underline"
                    >
                      Hôm nay
                    </button>
                  </div>
                  <input
                    type="date"
                    value={receiptForm.date}
                    onChange={e => {
                      const val = e.target.value;
                      setReceiptForm(prev => prev ? { ...prev, date: val } : null);
                    }}
                    className="w-full max-w-full min-w-0 block box-border bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Ghi Chú Thêm
                  </label>
                  <input
                    type="text"
                    value={receiptForm.note}
                    onChange={e => {
                      const val = e.target.value;
                      setReceiptForm(prev => prev ? { ...prev, note: val } : null);
                    }}
                    placeholder="Mô tả bổ sung hoặc mã GD..."
                    className="w-full max-w-full min-w-0 block box-border bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
              </div>

              {/* 6. Chi Cho Ai (Phân loại thành viên & con cái) */}
              {receiptForm.type === 'out' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Chi Cho Ai (Phân loại cá nhân & con cái)
                    </label>
                    <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                      {beneficiariesList.find(b => b.key === (receiptForm.beneficiary || 'family'))?.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {beneficiariesList.map(b => {
                      const isSelected = (receiptForm.beneficiary || 'family') === b.key;
                      return (
                        <button
                          key={b.key}
                          type="button"
                          onClick={() => setReceiptForm(prev => prev ? { ...prev, beneficiary: b.key } : null)}
                          className={`p-2.5 rounded-2xl text-left border transition-all flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-violet-50 dark:bg-violet-950/60 border-violet-500 dark:border-violet-400 text-violet-900 dark:text-violet-100 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-base shrink-0">{b.avatar}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate leading-tight">{b.name}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 7. Chi tiết từng món hàng (nếu có bóc tách từ hóa đơn siêu thị/nhà hàng) */}
              {scanResult?.items && scanResult.items.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowReceiptItems(prev => !prev)}
                    className="w-full flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 py-1"
                  >
                    <span className="flex items-center gap-1.5">
                      <Store size={14} className="text-violet-500" />
                      <span>Chi tiết các món hàng bóc tách ({scanResult.items.length} món)</span>
                    </span>
                    {showReceiptItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showReceiptItems && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto text-xs bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      {scanResult.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-200/40 dark:border-slate-700/40 last:border-none">
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate pr-2">
                            {item.name} {item.qty ? <span className="text-slate-400">(x{item.qty})</span> : ''}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white shrink-0">
                            {formatVND(item.price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 7. Action Save Buttons */}
              <div className="pt-2 space-y-2">
                {hasSavedReceipt ? (
                  <div className="space-y-2">
                    <div className="w-full py-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-2">
                      <CheckCircle2 size={18} />
                      <span>Đã lưu vào sổ thu chi thành công!</span>
                    </div>
                    <button
                      type="button"
                      onClick={resetReceiptScanner}
                      className="w-full min-h-[46px] py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-2xl transition-all cursor-pointer"
                    >
                      Tiếp tục quét hóa đơn khác
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleSaveScannedReceipt}
                      className="flex-1 min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus size={18} />
                      <span>Lưu Vào Sổ Thu Chi Ngay</span>
                    </button>
                    <button
                      type="button"
                      onClick={resetReceiptScanner}
                      className="min-h-[48px] px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm transition-all cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. SUBTAB 2: FINANCIAL ADVISOR 50/30/20 */}
      {subTab === 'advisor' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Phân Tích Sức Khỏe Tài Chính Tháng
                </h3>
                <p className="text-xs text-slate-400">
                  AI đánh giá toàn diện thu, chi, nợ và đưa ra khuyến nghị thực tế.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateAdvice}
                disabled={isAnalyzing}
                className="min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-sm hover:from-violet-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-all"
              >
                <RefreshCw size={15} className={isAnalyzing ? 'animate-spin' : ''} />
                <span>{isAnalyzing ? 'Đang phân tích...' : 'Bắt đầu đánh giá'}</span>
              </button>
            </div>

            {adviceError && (
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{adviceError}</span>
              </div>
            )}
          </div>

          {/* Advice Output */}
          {adviceResult && (
            <div className="space-y-4 animate-in fade-in">
              {/* Score card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Điểm sức khỏe tài chính
                  </span>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {adviceResult.healthStatus}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    {adviceResult.summary}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border-4 border-emerald-500 flex items-center justify-center font-black text-xl text-emerald-600 dark:text-emerald-400 shrink-0">
                  {adviceResult.financialHealthScore}
                </div>
              </div>

              {/* 50/30/20 Assessment */}
              {adviceResult.rule503020 && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Đánh giá quy tắc 50/30/20
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {adviceResult.rule503020.comment}
                  </p>
                </div>
              )}

              {/* Action recommendations */}
              {adviceResult.actionSteps && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                    3 Lời khuyên hành động cụ thể
                  </span>
                  <div className="space-y-2">
                    {adviceResult.actionSteps.map((step: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-start gap-3"
                      >
                        <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            {step.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {step.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. SUBTAB 3: QUICK TEXT BÓC TÁCH */}
      {subTab === 'quick' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Ghi Sổ Bằng Ngôn Ngữ Tự Nhiên
            </h3>
            <p className="text-xs text-slate-400">
              Gõ tự nhiên như nhắn tin: AI sẽ tự tách số tiền, danh mục, thời gian và ghi chú.
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              rows={3}
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              placeholder="VD: Chiều nay đổ xăng 80k cây Petrolimex và mua 2 gói bánh 30k ở Winmart thanh toán MoMo"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <button
              type="button"
              onClick={handleQuickTextParse}
              disabled={isQuickProcessing || !quickInput.trim()}
              className="w-full min-h-[46px] py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold rounded-2xl shadow-sm hover:from-violet-700 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Sparkles size={16} />
              <span>{isQuickProcessing ? 'Đang bóc tách...' : 'Phân tích & Điền giao dịch'}</span>
            </button>
          </div>

          {quickForm && (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-violet-200 dark:border-violet-900/60 shadow-md space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <Edit3 size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Xác Nhận & Chỉnh Sửa Giao Dịch
                    </h4>
                    <p className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                      Bóc tách từ lời nói / văn bản • Bạn có thể tùy chỉnh mọi mục
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuickResult(null);
                    setQuickForm(null);
                    setHasSavedQuick(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Đóng"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Loại giao dịch */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Loại Giao Dịch
                </label>
                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickForm(prev => prev ? {
                        ...prev,
                        type: 'out',
                        category: resolveValidCategory(prev.type === 'out' ? prev.category : undefined, 'out')
                      } : null);
                    }}
                    className={`min-h-[42px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      quickForm.type === 'out'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Chi tiền (Khoản chi)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickForm(prev => prev ? {
                        ...prev,
                        type: 'in',
                        category: resolveValidCategory(prev.type === 'in' ? prev.category : undefined, 'in')
                      } : null);
                    }}
                    className={`min-h-[42px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      quickForm.type === 'in'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Thu tiền (Khoản thu)
                  </button>
                </div>
              </div>

              {/* Số tiền */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                  <span>Số Tiền (VNĐ)</span>
                  <span className="text-violet-600 dark:text-violet-400 font-bold">
                    {formatVND(quickForm.amount)}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={quickForm.amount || ''}
                    onChange={e => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setQuickForm(prev => prev ? { ...prev, amount: val } : null);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    đ
                  </span>
                </div>
              </div>

              {/* Tên giao dịch / Ghi chú */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Tên Giao Dịch / Ghi Chú
                </label>
                <input
                  type="text"
                  value={quickForm.merchant}
                  onChange={e => {
                    const val = e.target.value;
                    setQuickForm(prev => prev ? { ...prev, merchant: val } : null);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              {/* Danh mục & Tài khoản */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Danh Mục
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-2.5 pointer-events-none">
                      <CategoryIcon catKey={resolveValidCategory(quickForm.category, quickForm.type)} size="sm" />
                    </div>
                    <select
                      value={resolveValidCategory(quickForm.category, quickForm.type)}
                      onChange={e => {
                        const val = e.target.value;
                        setQuickForm(prev => prev ? { ...prev, category: val } : null);
                      }}
                      className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-8 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 appearance-none cursor-pointer truncate"
                    >
                      {renderCategoryOptions(quickForm.type)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Tài Khoản / Thẻ Trừ Tiền
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 text-slate-400 pointer-events-none">
                      <Wallet size={15} />
                    </div>
                    <select
                      value={quickForm.accountId}
                      onChange={e => {
                        const val = e.target.value;
                        setQuickForm(prev => prev ? { ...prev, accountId: val } : null);
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 appearance-none cursor-pointer"
                    >
                      <option value="">-- Không trừ ví/thẻ --</option>
                      <optgroup label="Ví & Tài khoản ngân hàng">
                        {data.accts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            🏦 {acc.name} ({formatVND(acc.balance)})
                          </option>
                        ))}
                      </optgroup>
                      {data.cards.length > 0 && (
                        <optgroup label="Thẻ tín dụng (Ghi nợ chi tiêu)">
                          {data.cards.map(card => (
                            <option key={card.id} value={card.id}>
                              💳 {card.name} (Dư nợ: {formatVND(card.currentBalance)})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Chi Cho Ai (Phân loại cá nhân & con cái) */}
              {quickForm.type === 'out' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Chi Cho Ai (Phân loại thành viên & con cái)
                    </label>
                    <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                      {beneficiariesList.find(b => b.key === (quickForm.beneficiary || 'family'))?.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {beneficiariesList.map(b => {
                      const isSelected = (quickForm.beneficiary || 'family') === b.key;
                      return (
                        <button
                          key={b.key}
                          type="button"
                          onClick={() => setQuickForm(prev => prev ? { ...prev, beneficiary: b.key } : null)}
                          className={`p-2.5 rounded-2xl text-left border transition-all flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-violet-50 dark:bg-violet-950/60 border-violet-500 dark:border-violet-400 text-violet-900 dark:text-violet-100 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-base shrink-0">{b.avatar}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate leading-tight">{b.name}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ngày giao dịch */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Ngày Giao Dịch
                </label>
                <input
                  type="date"
                  value={quickForm.date}
                  onChange={e => {
                    const val = e.target.value;
                    setQuickForm(prev => prev ? { ...prev, date: val } : null);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                {hasSavedQuick ? (
                  <div className="space-y-2">
                    <div className="w-full py-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-2">
                      <CheckCircle2 size={18} />
                      <span>Đã lưu vào sổ thu chi thành công!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickInput('');
                        setQuickResult(null);
                        setQuickForm(null);
                        setHasSavedQuick(false);
                      }}
                      className="w-full min-h-[46px] py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-2xl transition-all cursor-pointer"
                    >
                      Nhập thêm giao dịch khác
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleSaveQuick}
                      className="flex-1 min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus size={18} />
                      <span>Lưu Vào Sổ Thu Chi Ngay</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickResult(null);
                        setQuickForm(null);
                      }}
                      className="min-h-[48px] px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm transition-all cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
