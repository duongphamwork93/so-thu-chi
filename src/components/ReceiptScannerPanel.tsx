import React, { useMemo, useState } from 'react';
import {
  Camera,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Store,
  RefreshCw,
  Plus,
  Image as ImageIcon,
  Check,
  HelpCircle,
  Edit3,
  Wallet,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFinance } from '../context/FinanceContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants/categories';
import { formatVND, getTodayDateString } from '../utils/formatters';
import { compressImage } from '../utils/imageCompressor';
import { resolveDefaultPaymentAccountId } from '../utils/paymentMatcher';
import { BeneficiaryKey } from '../types/finance';
import { getBeneficiaries } from '../constants/beneficiaries';
import { CategoryIcon } from './CategoryIcon';

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

interface ScannedTransactionItem {
  id: string;
  sourceImageId?: string;
  sourceImageLabel?: string;
  merchant: string;
  amount: number;
  type: 'in' | 'out';
  category: string;
  date: string;
  dateDefaultedToToday?: boolean;
  accountId: string;
  note: string;
  beneficiary?: BeneficiaryKey;
  selected: boolean;
}

interface SingleReceiptForm {
  merchant: string;
  amount: number;
  type: 'in' | 'out';
  category: string;
  date: string;
  dateDefaultedToToday?: boolean;
  accountId: string;
  note: string;
  beneficiary?: BeneficiaryKey;
}

interface ReceiptScannerPanelProps {
  /** Compact embedded mode for inside AddTransactionModal */
  compact?: boolean;
  /** Default date when receipt image has no printed date (defaults to today's upload date) */
  defaultDate?: string;
  /** Optional shortcut when scan fails in AIAdvisorView */
  onSwitchToQuickText?: () => void;
  /** Optional close handler inside modals after saving */
  onSavedAndClose?: () => void;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const ReceiptScannerPanel: React.FC<ReceiptScannerPanelProps> = ({
  compact = false,
  defaultDate,
  onSwitchToQuickText,
  onSavedAndClose,
}) => {
  const {
    data,
    currentMonth,
    setCurrentMonth,
    addTransaction,
    allExpenseCategories,
    allIncomeCategories,
  } = useFinance();

  const beneficiariesList = useMemo(
    () => getBeneficiaries(data.settings.memberNames, data.settings.customMembers),
    [data.settings.memberNames, data.settings.customMembers]
  );

  const [selectedImages, setSelectedImages] = useState<QueuedReceiptImage[]>([]);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasSavedReceipt, setHasSavedReceipt] = useState<boolean>(false);
  const [savedBatchCount, setSavedBatchCount] = useState<number>(0);
  const [showReceiptItems, setShowReceiptItems] = useState<boolean>(false);
  const [scannedItems, setScannedItems] = useState<ScannedTransactionItem[]>([]);
  const [receiptForm, setReceiptForm] = useState<SingleReceiptForm | null>(null);

  const resolveValidCategory = (catKey: string | undefined, txType: 'in' | 'out'): string => {
    const list = txType === 'out' ? allExpenseCategories : allIncomeCategories;
    if (catKey && list.some(c => c.key === catKey)) return catKey;
    return txType === 'out' ? 'an_uong' : 'thu_khac';
  };

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

  const handleImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

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
        setScanError(
          `Mỗi lượt quét tối đa ${MAX_IMAGES} ảnh để đảm bảo tốc độ ổn định. Đã thêm ${filesToProcess.length} ảnh đầu tiên.`
        );
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
        setReceiptForm(null);
      }
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const formatScanErrorMessage = (rawMsg: string): string => {
    const trimmed = (rawMsg || '').trim();
    let extracted = trimmed;
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        extracted = parsed?.error?.message || trimmed;
      } catch {
        // keep original
      }
    }
    const lower = extracted.toLowerCase();
    if (
      lower.includes('503') ||
      lower.includes('unavailable') ||
      lower.includes('high demand') ||
      lower.includes('overloaded')
    ) {
      return 'Máy chủ AI đang tạm thời quá tải (mã 503). Bạn đợi vài giây rồi bấm "Thử quét lại" nhé!';
    }
    if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
      return 'Hệ thống AI tạm chạm giới hạn lượt gọi. Bạn đợi khoảng 15–30 giây rồi bấm "Thử quét lại" nhé!';
    }
    return extracted || 'Không thể bóc tách dữ liệu từ hình ảnh này.';
  };

  const scanSingleQueuedImage = async (img: QueuedReceiptImage, imageLabel: string) => {
    // Always default missing purchase date to today's upload date (local timezone)
    const uploadToday = defaultDate || getTodayDateString();
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const res = await fetch('/api/gemini/parse-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: img.base64,
            mimeType: 'image/jpeg',
            todayDate: uploadToday,
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
          } else if ((res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          } else {
            throw new Error(`Máy chủ phản hồi mã lỗi ${res.status}. Vui lòng thử lại.`);
          }
        }

        if (!res.ok || !json.success) {
          const rawErr = String(json?.error || '');
          const isTransient =
            res.status === 503 ||
            res.status === 502 ||
            res.status === 504 ||
            res.status === 429 ||
            /unavailable|high demand|overloaded|503/i.test(rawErr);

          if (isTransient && attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          if (rawErr.includes('GEMINI_API_KEY')) {
            throw new Error(
              'Chưa cấu hình GEMINI_API_KEY trên máy chủ (Vào Vercel > Settings > Environment Variables để thêm).'
            );
          }
          throw new Error(formatScanErrorMessage(rawErr));
        }

        const raw = json.data || {};
        const rawList: any[] =
          Array.isArray(raw.transactions) && raw.transactions.length > 0
            ? raw.transactions
            : raw.amount
            ? [raw]
            : [];

        const mapped: ScannedTransactionItem[] = rawList.map((t, idx) => {
          const isInc = t.type === 'in';
          const txType = isInc ? ('in' as const) : ('out' as const);
          const safeCategory = resolveValidCategory(t.category, txType);
          const isChildCat = [
            'con_sua_bim',
            'giao_duc',
            'con_sach_vo',
            'con_do_dung',
            'con_y_te',
            'con_tieu_vat',
          ].includes(safeCategory);
          const resolvedAcc = resolveDefaultPaymentAccountId({
            type: txType,
            text: `${t.merchant || ''} ${t.note || ''}`,
            data,
          });

          const hasValidDate =
            typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date.trim());
          const resolvedDate = hasValidDate ? t.date.trim() : uploadToday;
          const defaulted = !hasValidDate || Boolean(t.dateDefaultedToToday);

          return {
            id: `scan_${Date.now()}_${img.id.slice(-4)}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            sourceImageId: img.id,
            sourceImageLabel: imageLabel,
            merchant: t.merchant || 'Hóa đơn / Giao dịch',
            amount: Number(t.amount) || 0,
            type: txType,
            category: safeCategory,
            date: resolvedDate,
            dateDefaultedToToday: defaulted,
            accountId: resolvedAcc.accountId,
            note: t.note || '',
            beneficiary: (isInc ? undefined : isChildCat ? 'both_children' : 'family') as
              | BeneficiaryKey
              | undefined,
            selected: true,
          };
        });

        return { raw, mapped };
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          throw new Error('Quét quá thời gian dự kiến (mạng chậm hoặc ảnh phức tạp).');
        }
        if (err.message === 'Load failed' || err.message === 'Failed to fetch') {
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          throw new Error(
            'Lỗi kết nối máy chủ ("Load failed"). Nếu bạn đã đưa lên Vercel, hãy kiểm tra xem đã thêm GEMINI_API_KEY vào Project Settings > Environment Variables chưa.'
          );
        }
        throw new Error(formatScanErrorMessage(err?.message || 'Lỗi khi phân tích ảnh'));
      }
    }

    throw new Error('Không thể hoàn tất quét hóa đơn. Vui lòng thử lại.');
  };

  const handleScanReceipts = async (onlyTargetIds?: string[]) => {
    if (selectedImages.length === 0) return;

    const pendingOrError = selectedImages.filter(img => img.status === 'pending' || img.status === 'error');
    const targets = onlyTargetIds
      ? selectedImages.filter(img => onlyTargetIds.includes(img.id))
      : pendingOrError.length > 0
      ? pendingOrError
      : selectedImages;

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
      setScannedItems(prev => prev.filter(it => !it.sourceImageId || !targetIdSet.has(it.sourceImageId)));
    }

    setSelectedImages(prev =>
      prev.map(img =>
        targetIdSet.has(img.id) ? { ...img, status: 'pending', errorMsg: undefined } : img
      )
    );

    const allNewItems: ScannedTransactionItem[] = [];
    let lastSingleRaw: any = null;
    let firstErrorMsg: string | null = null;
    let completedCount = 0;

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
          prev.map(img =>
            img.id === current.id ? { ...img, status: 'scanning', errorMsg: undefined } : img
          )
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
      setScanError(
        `Một số ảnh chưa quét được (${firstErrorMsg}). Bạn có thể bấm "Quét lại" trên ảnh bị lỗi.`
      );
    }

    if (allNewItems.length > 0) {
      confetti({
        particleCount: Math.min(100, 40 + allNewItems.length * 12),
        spread: 65,
        origin: { y: 0.7 },
      });
    }

    setIsScanning(false);
    setScanProgress(null);
  };

  const handleSaveScannedReceipt = () => {
    if (!receiptForm) return;
    const txDate = receiptForm.date || defaultDate || getTodayDateString();
    addTransaction({
      type: receiptForm.type,
      cat: receiptForm.category || (receiptForm.type === 'in' ? 'luong' : 'an_uong'),
      amount: Number(receiptForm.amount) || 0,
      date: txDate,
      note: `${receiptForm.merchant}${receiptForm.note ? ` - ${receiptForm.note}` : ''}`.trim(),
      accountId: receiptForm.accountId || undefined,
      beneficiary: receiptForm.type === 'out' ? receiptForm.beneficiary || 'family' : undefined,
    });

    const targetMonth = txDate.slice(0, 7);
    if (targetMonth && targetMonth !== currentMonth) {
      setCurrentMonth(targetMonth);
    }

    setHasSavedReceipt(true);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  };

  const handleSaveAllSelectedScanned = () => {
    const selected = scannedItems.filter(item => item.selected && item.amount > 0);
    if (selected.length === 0) return;

    let targetMonth = '';
    selected.forEach(item => {
      const txDate = item.date || defaultDate || getTodayDateString();
      targetMonth = txDate.slice(0, 7);
      addTransaction({
        type: item.type,
        cat: item.category || (item.type === 'in' ? 'luong' : 'an_uong'),
        amount: Number(item.amount) || 0,
        date: txDate,
        note: `${item.merchant}${item.note ? ` - ${item.note}` : ''}`.trim(),
        accountId: item.accountId || undefined,
        beneficiary: item.type === 'out' ? item.beneficiary || 'family' : undefined,
      });
    });

    if (targetMonth && targetMonth !== currentMonth) {
      setCurrentMonth(targetMonth);
    }

    setSavedBatchCount(selected.length);
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
  };

  return (
    <div
      className={
        compact
          ? 'space-y-4'
          : 'bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4'
      }
    >
      {!compact && (
        <div className="text-center space-y-1">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Chụp Hoặc Tải Lên Ảnh Hóa Đơn
          </h3>
          <p className="text-xs text-slate-400">
            Hỗ trợ hóa đơn siêu thị, nhà thuốc, đơn Shopee, biên lai chuyển khoản... Ảnh không có ngày tự đặt ngày hôm nay.
          </p>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl text-center hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
          compact ? 'p-3.5' : 'p-4'
        }`}
      >
        {isCompressing ? (
          <div className="py-7 space-y-2.5">
            <RefreshCw size={26} className="animate-spin mx-auto text-violet-600" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Đang tối ưu hóa danh sách ảnh...
            </p>
            <p className="text-[11px] text-slate-400">
              Giảm kích thước file để quét nhiều ảnh siêu nhanh
            </p>
          </div>
        ) : selectedImages.length > 0 ? (
          <div className="space-y-3.5">
            {selectedImages.length === 1 ? (
              <div className="relative inline-block max-w-full">
                <img
                  src={selectedImages[0].base64}
                  alt={selectedImages[0].name}
                  className={`${
                    compact ? 'max-h-52' : 'max-h-64'
                  } mx-auto rounded-2xl shadow-md object-contain border border-slate-200 dark:border-slate-700`}
                />
                <button
                  type="button"
                  onClick={resetReceiptScanner}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-900/75 hover:bg-rose-600 text-white flex items-center justify-center shadow-sm cursor-pointer transition-colors"
                  title="Xóa ảnh này"
                >
                  <X size={16} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-slate-900/85 text-emerald-300 text-[10px] font-bold backdrop-blur-xs flex items-center gap-1 shadow-xs whitespace-nowrap">
                  <span>
                    ⚡ Đã nén: {selectedImages[0].origSize} ➔ {selectedImages[0].compSize}
                  </span>
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

                <div
                  className={`grid grid-cols-2 sm:grid-cols-3 gap-2.5 ${
                    compact ? 'max-h-60' : 'max-h-80'
                  } overflow-y-auto p-1`}
                >
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

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <label className="min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-bold rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all">
                <Camera size={15} />
                <span>Chụp thêm</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImagesChange}
                  className="hidden"
                />
              </label>

              <label className="min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-bold rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all">
                <ImageIcon size={15} />
                <span>+ Thêm nhiều ảnh</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImagesChange}
                  className="hidden"
                />
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
                        const pendingCount = selectedImages.filter(
                          i => i.status === 'pending' || i.status === 'error'
                        ).length;
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
              <div className="w-full max-w-md mx-auto p-3 rounded-2xl bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-center space-y-2">
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
                      style={{
                        width: `${Math.round((scanProgress.done / scanProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Kết quả sẽ gom đầy đủ bên dưới để bạn kiểm tra & lưu 1 chạm
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className={`${compact ? 'py-4 space-y-3.5' : 'py-6 space-y-4'}`}>
            <div className="w-13 h-13 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto shadow-xs">
              <Camera size={24} />
            </div>
            <div className="px-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Chụp hoặc tải 1 hay nhiều ảnh hóa đơn cùng lúc
              </p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Hỗ trợ hóa đơn siêu thị, nhà thuốc, đơn Shopee, biên lai chuyển khoản. Ảnh không ghi ngày mua sẽ mặc định lấy ngày hôm nay.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-md mx-auto">
              <label className="w-full sm:w-auto flex-1 min-h-[46px] px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 text-white text-sm font-bold rounded-2xl shadow-sm cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Camera size={18} />
                <span>Mở máy ảnh chụp</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImagesChange}
                  className="hidden"
                />
              </label>

              <label className="w-full sm:w-auto flex-1 min-h-[46px] px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-all">
                <ImageIcon size={18} />
                <span>Chọn nhiều ảnh</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImagesChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Error Card */}
      {scanError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-800 dark:text-rose-200">
                Không thể hoàn tất quét hóa đơn
              </p>
              <p className="leading-relaxed text-[11.5px]">{scanError}</p>
            </div>
          </div>

          {(scanError.includes('Vercel') ||
            scanError.includes('GEMINI_API_KEY') ||
            scanError.includes('Load failed')) && (
            <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-rose-200/60 dark:border-rose-800/60 text-slate-700 dark:text-slate-300 space-y-1.5 text-[11px]">
              <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <HelpCircle size={13} className="text-violet-600" />
                <span>Hướng dẫn cài đặt nhanh cho Vercel:</span>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400 pl-1">
                <li>
                  Đăng nhập <strong className="text-slate-800 dark:text-slate-200">vercel.com</strong>{' '}
                  và chọn dự án{' '}
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">
                    so-thu-chi
                  </code>
                </li>
                <li>
                  Vào mục <strong className="text-slate-800 dark:text-slate-200">Settings</strong> ➔{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    Environment Variables
                  </strong>
                </li>
                <li>
                  Tạo biến mới với Key:{' '}
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] font-mono">
                    GEMINI_API_KEY
                  </code>{' '}
                  và dán mã API Gemini của bạn vào
                </li>
                <li>
                  Vào tab{' '}
                  <strong className="text-slate-800 dark:text-slate-200">Deployments</strong> ➔ chọn
                  dấu ba chấm (...) ➔ bấm{' '}
                  <strong className="text-slate-800 dark:text-slate-200">Redeploy</strong>
                </li>
              </ol>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleScanReceipts()}
              className="min-h-[36px] px-3.5 py-1.5 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Thử quét lại</span>
            </button>
            {onSwitchToQuickText && (
              <button
                type="button"
                onClick={onSwitchToQuickText}
                className="min-h-[36px] px-3.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText size={13} />
                <span>Nhập nhanh bằng chữ</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Multi-transaction Result Card */}
      {scannedItems.length > 0 && !receiptForm && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-violet-200 dark:border-violet-900/60 shadow-sm space-y-3.5 animate-in fade-in">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  Danh sách {scannedItems.length} khoản giao dịch
                </h4>
                <p className="text-[11px] sm:text-xs text-violet-600 dark:text-violet-400 font-medium">
                  AI đã bóc tách • Sửa hoặc xóa riêng từng khoản
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
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-violet-50/70 dark:bg-slate-800/80 border border-violet-100 dark:border-slate-700/60 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => {
                const allSelected = scannedItems.every(i => i.selected);
                setScannedItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
              }}
              className="min-h-[38px] px-2 py-1 rounded-xl font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-100/70 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={scannedItems.every(i => i.selected)}
                readOnly
                className="w-5 h-5 rounded text-violet-600 focus:ring-0 cursor-pointer"
              />
              <span>
                {scannedItems.every(i => i.selected) ? 'Bỏ chọn' : 'Chọn tất cả'} (
                {scannedItems.filter(i => i.selected).length}/{scannedItems.length})
              </span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const today = getTodayDateString();
                  setScannedItems(prev =>
                    prev.map(i => ({ ...i, date: today, dateDefaultedToToday: false }))
                  );
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-slate-600 hover:bg-violet-100 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-2xs cursor-pointer"
                title="Đặt tất cả các khoản về ngày hôm nay"
              >
                <Calendar size={14} />
                <span>Đặt hôm nay</span>
              </button>

              <div className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                Tổng:{' '}
                <span className="text-violet-600 dark:text-violet-400">
                  {formatVND(
                    scannedItems.filter(i => i.selected).reduce((sum, i) => sum + (i.amount || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction Cards List */}
          <div className={`space-y-3 ${compact ? '' : 'max-h-[60vh] overflow-y-auto pr-1'}`}>
            {scannedItems.map((item, idx) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                  item.selected
                    ? 'bg-white dark:bg-slate-800/90 border-violet-300 dark:border-violet-700/80 shadow-xs'
                    : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                {/* Item Top row */}
                <div className="flex items-center justify-between gap-2">
                  <label className="min-h-[38px] flex items-center gap-2 pr-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={e => {
                        const checked = e.target.checked;
                        setScannedItems(prev =>
                          prev.map(it => (it.id === item.id ? { ...it, selected: checked } : it))
                        );
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

                  <div className="flex items-center gap-1.5">
                    <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setScannedItems(prev =>
                            prev.map(it =>
                              it.id === item.id
                                ? {
                                    ...it,
                                    type: 'out',
                                    category: resolveValidCategory(
                                      it.type === 'out' ? it.category : undefined,
                                      'out'
                                    ),
                                  }
                                : it
                            )
                          );
                        }}
                        className={`min-h-[32px] px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          item.type === 'out'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Chi (-)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScannedItems(prev =>
                            prev.map(it =>
                              it.id === item.id
                                ? {
                                    ...it,
                                    type: 'in',
                                    category: resolveValidCategory(
                                      it.type === 'in' ? it.category : undefined,
                                      'in'
                                    ),
                                  }
                                : it
                            )
                          );
                        }}
                        className={`min-h-[32px] px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          item.type === 'in'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Thu (+)
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setScannedItems(prev => prev.filter(it => it.id !== item.id));
                      }}
                      className="w-9 h-9 rounded-xl bg-rose-50/90 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-500 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0"
                      title={`Xóa riêng Khoản #${idx + 1}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Amount & Merchant */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                      Số tiền (VNĐ)
                    </label>
                    <input
                      type="number"
                      value={item.amount || ''}
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setScannedItems(prev =>
                          prev.map(it => (it.id === item.id ? { ...it, amount: val } : it))
                        );
                      }}
                      className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                      Đối tác / Cửa hàng
                    </label>
                    <input
                      type="text"
                      value={item.merchant}
                      onChange={e => {
                        const val = e.target.value;
                        setScannedItems(prev =>
                          prev.map(it => (it.id === item.id ? { ...it, merchant: val } : it))
                        );
                      }}
                      className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>
                </div>

                {/* Category, Wallet & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0">
                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                      Danh mục
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-2.5 pointer-events-none">
                        <CategoryIcon catKey={resolveValidCategory(item.category, item.type)} size="sm" />
                      </div>
                      <select
                        value={resolveValidCategory(item.category, item.type)}
                        onChange={e => {
                          const val = e.target.value;
                          setScannedItems(prev =>
                            prev.map(it => (it.id === item.id ? { ...it, category: val } : it))
                          );
                        }}
                        className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-8 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none appearance-none cursor-pointer truncate"
                      >
                        {renderCategoryOptions(item.type)}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-3 text-slate-400 pointer-events-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                      Tài khoản / Thẻ
                    </label>
                    <select
                      value={item.accountId}
                      onChange={e => {
                        const val = e.target.value;
                        setScannedItems(prev =>
                          prev.map(it => (it.id === item.id ? { ...it, accountId: val } : it))
                        );
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
                    <div className="flex items-center justify-between gap-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase">
                        Ngày ghi
                      </label>
                      {item.dateDefaultedToToday && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                          Mặc định hôm nay
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={item.date}
                      onChange={e => {
                        const val = e.target.value;
                        setScannedItems(prev =>
                          prev.map(it =>
                            it.id === item.id
                              ? { ...it, date: val, dateDefaultedToToday: false }
                              : it
                          )
                        );
                      }}
                      className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Note row */}
                <div className="space-y-1 min-w-0">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">
                    Ghi chú / Sản phẩm
                  </label>
                  <input
                    type="text"
                    value={item.note}
                    onChange={e => {
                      const val = e.target.value;
                      setScannedItems(prev =>
                        prev.map(it => (it.id === item.id ? { ...it, note: val } : it))
                      );
                    }}
                    placeholder="Nội dung chuyển khoản hoặc tên sản phẩm..."
                    className="w-full max-w-full min-w-0 min-h-[42px] block box-border bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                {/* Chi cho ai */}
                {item.type === 'out' && (
                  <div className="space-y-1 min-w-0 pt-0.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                      <span>Chi cho ai (Cá nhân / Con cái)</span>
                      {item.beneficiary === 'both_children' && (
                        <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                          ⚡ Chia đôi 50/50
                        </span>
                      )}
                    </label>
                    <select
                      value={item.beneficiary || 'family'}
                      onChange={e => {
                        const val = e.target.value as BeneficiaryKey;
                        setScannedItems(prev =>
                          prev.map(it => (it.id === item.id ? { ...it, beneficiary: val } : it))
                        );
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
                <div className="w-full py-3.5 px-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 text-center">
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>Đã lưu thành công {savedBatchCount} giao dịch vào Sổ Thu Chi!</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetReceiptScanner}
                    className="flex-1 min-h-[46px] py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-2xl transition-all cursor-pointer"
                  >
                    Quét thêm ảnh khác
                  </button>
                  {onSavedAndClose && (
                    <button
                      type="button"
                      onClick={onSavedAndClose}
                      className="flex-1 min-h-[46px] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-sm transition-all cursor-pointer"
                    >
                      Xong
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveAllSelectedScanned}
                  disabled={scannedItems.filter(i => i.selected && i.amount > 0).length === 0}
                  className="flex-1 min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus size={18} />
                  <span>
                    Lưu {scannedItems.filter(i => i.selected && i.amount > 0).length} Khoản Vào Sổ
                  </span>
                </button>
                <button
                  type="button"
                  onClick={resetReceiptScanner}
                  className="min-h-[48px] px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm transition-all cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single-transaction Result Card */}
      {receiptForm && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-violet-200 dark:border-violet-900/60 shadow-sm space-y-3.5 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                <Edit3 size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
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
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Đóng / Hủy bỏ"
            >
              <X size={16} />
            </button>
          </div>

          {/* 1. Loại giao dịch */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Loại Giao Dịch
            </label>
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setReceiptForm(prev =>
                    prev
                      ? {
                          ...prev,
                          type: 'out',
                          category: prev.type === 'out' ? prev.category : 'an_uong',
                        }
                      : null
                  );
                }}
                className={`min-h-[42px] py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
                  setReceiptForm(prev =>
                    prev
                      ? {
                          ...prev,
                          type: 'in',
                          category: prev.type === 'in' ? prev.category : 'thu_khac',
                        }
                      : null
                  );
                }}
                className={`min-h-[42px] py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  receiptForm.type === 'in'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Thu tiền (Khoản thu)
              </button>
            </div>
          </div>

          {/* 2. Số tiền */}
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
                  setReceiptForm(prev => (prev ? { ...prev, amount: val } : null));
                }}
                placeholder="0"
                className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                đ
              </span>
            </div>
          </div>

          {/* 3. Tên giao dịch / Cửa hàng */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Tên Giao Dịch / Cửa Hàng / Người Nhận
            </label>
            <input
              type="text"
              value={receiptForm.merchant}
              onChange={e => {
                const val = e.target.value;
                setReceiptForm(prev => (prev ? { ...prev, merchant: val } : null));
              }}
              placeholder="VD: Nhà thuốc Long Châu, WinMart, Petrolimex..."
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          {/* 4. Danh mục & Tài khoản */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Danh Mục
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-2.5 pointer-events-none">
                  <CategoryIcon
                    catKey={resolveValidCategory(receiptForm.category, receiptForm.type)}
                    size="sm"
                  />
                </div>
                <select
                  value={resolveValidCategory(receiptForm.category, receiptForm.type)}
                  onChange={e => {
                    const val = e.target.value;
                    setReceiptForm(prev => (prev ? { ...prev, category: val } : null));
                  }}
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-8 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 appearance-none cursor-pointer truncate"
                >
                  {renderCategoryOptions(receiptForm.type)}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 text-slate-400 pointer-events-none"
                />
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
                    setReceiptForm(prev => (prev ? { ...prev, accountId: val } : null));
                  }}
                  className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 appearance-none cursor-pointer truncate"
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
                <ChevronDown
                  size={14}
                  className="absolute right-3 text-slate-400 pointer-events-none"
                />
              </div>
            </div>
          </div>

          {/* 5. Ngày giao dịch & Ghi chú */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Ngày Giao Dịch
                </label>
                {receiptForm.dateDefaultedToToday ? (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    Mặc định hôm nay
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptForm(prev =>
                        prev ? { ...prev, date: getTodayDateString(), dateDefaultedToToday: false } : null
                      );
                    }}
                    className="text-[10px] text-violet-600 dark:text-violet-400 font-bold hover:underline cursor-pointer"
                  >
                    Đặt hôm nay
                  </button>
                )}
              </div>
              <input
                type="date"
                value={receiptForm.date}
                onChange={e => {
                  const val = e.target.value;
                  setReceiptForm(prev =>
                    prev ? { ...prev, date: val, dateDefaultedToToday: false } : null
                  );
                }}
                className="w-full max-w-full min-w-0 min-h-[44px] block box-border bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
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
                  setReceiptForm(prev => (prev ? { ...prev, note: val } : null));
                }}
                placeholder="Mô tả bổ sung hoặc tên sản phẩm..."
                className="w-full max-w-full min-w-0 min-h-[44px] block box-border bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>

          {/* 6. Chi Cho Ai */}
          {receiptForm.type === 'out' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Chi Cho Ai (Cá nhân & con cái)
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
                      onClick={() =>
                        setReceiptForm(prev => (prev ? { ...prev, beneficiary: b.key } : null))
                      }
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

          {/* 7. Chi tiết từng món hàng */}
          {scanResult?.items && scanResult.items.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowReceiptItems(prev => !prev)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 py-1 cursor-pointer"
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
                    <div
                      key={idx}
                      className="flex justify-between items-center py-1 border-b border-slate-200/40 dark:border-slate-700/40 last:border-none"
                    >
                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate pr-2">
                        {item.name}{' '}
                        {item.qty ? <span className="text-slate-400">(x{item.qty})</span> : ''}
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

          {/* 8. Action Save Buttons */}
          <div className="pt-2 space-y-2">
            {hasSavedReceipt ? (
              <div className="space-y-2.5">
                <div className="w-full py-3 px-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>Đã lưu vào sổ thu chi thành công!</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetReceiptScanner}
                    className="flex-1 min-h-[46px] py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-2xl transition-all cursor-pointer"
                  >
                    Quét hóa đơn khác
                  </button>
                  {onSavedAndClose && (
                    <button
                      type="button"
                      onClick={onSavedAndClose}
                      className="flex-1 min-h-[46px] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-sm transition-all cursor-pointer"
                    >
                      Xong
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveScannedReceipt}
                  className="flex-1 min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus size={18} />
                  <span>Lưu Vào Sổ Thu Chi</span>
                </button>
                <button
                  type="button"
                  onClick={resetReceiptScanner}
                  className="min-h-[48px] px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm transition-all cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
