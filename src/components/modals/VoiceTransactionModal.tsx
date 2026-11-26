import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Mic,
  Square,
  Sparkles,
  Check,
  Edit3,
  RotateCcw,
  Volume2,
  MapPin,
  Users,
  Compass,
  Wallet,
  Loader2,
  Send,
  ChevronDown,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { CategoryIcon } from '../CategoryIcon';
import { formatVND, getTodayDateString, parseVietnameseMoneyText } from '../../utils/formatters';
import { resolveDefaultPaymentAccountId } from '../../utils/paymentMatcher';
import { encodeFloat32ChunksToWav } from '../../utils/audioWavRecorder';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, guessCategoryByText } from '../../constants/categories';
import { BeneficiaryKey, TransactionType } from '../../types/finance';

export interface ParsedVoiceTransaction {
  transcript: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  date: string;
  accountId?: string;
  accountLabel?: string;
  beneficiary?: BeneficiaryKey;
  location?: string;
  counterparty?: string;
  tripName?: string;
}

interface VoiceTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditInFullModal: (parsed: ParsedVoiceTransaction) => void;
}

const VOICE_EXAMPLES = [
  'Hôm nay tôi đi siêu thị hết một trăm nghìn từ tài khoản Vietcombank',
  'Ăn trưa bún chả với anh Nam 65 nghìn trả bằng MoMo',
  'Đổ xăng 70 nghìn ở cây xăng Petrolimex',
  'Nhận lương 25 triệu về tài khoản Vietcombank',
];

export const VoiceTransactionModal: React.FC<VoiceTransactionModalProps> = ({
  isOpen,
  onClose,
  onEditInFullModal,
}) => {
  const {
    data,
    addTransaction,
    updateSettings,
    allExpenseCategories,
    allIncomeCategories,
    categoryMap,
  } = useFinance();

  const [stage, setStage] = useState<'idle' | 'listening' | 'processing' | 'review'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedVoiceTransaction | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(44100);
  const usingWebAudioRef = useRef<boolean>(false);
  const speechRecRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const stopWatchdogRef = useRef<number | null>(null);
  const hasFinalizedRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const activeMimeRef = useRef<string>('audio/wav');
  const liveTranscriptRef = useRef<string>('');

  const cleanupRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (stopWatchdogRef.current) {
      window.clearTimeout(stopWatchdogRef.current);
      stopWatchdogRef.current = null;
    }
    if (speechRecRef.current) {
      try {
        speechRecRef.current.onresult = null;
        speechRecRef.current.onerror = null;
        speechRecRef.current.stop();
      } catch {
        // ignore
      }
      speechRecRef.current = null;
    }
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.onaudioprocess = null;
        scriptProcessorRef.current.disconnect();
      } catch {
        // ignore
      }
      scriptProcessorRef.current = null;
    }
    if (mediaSourceRef.current) {
      try {
        mediaSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      mediaSourceRef.current = null;
    }
    if (muteGainRef.current) {
      try {
        muteGainRef.current.disconnect();
      } catch {
        // ignore
      }
      muteGainRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
        }
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.onerror = null;
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      mediaStreamRef.current = null;
    }
    setMicLevel(0);
  };

  useEffect(() => {
    if (isOpen) {
      setStage('idle');
      setLiveTranscript('');
      liveTranscriptRef.current = '';
      setManualText('');
      setElapsedSec(0);
      setMicLevel(0);
      setErrorMsg(null);
      setParsedResult(null);
      setSavedNotice(false);
      hasFinalizedRef.current = false;
      isStoppingRef.current = false;
      usingWebAudioRef.current = false;
    } else {
      cleanupRecording();
    }
    return () => {
      cleanupRecording();
    };
  }, [isOpen]);

  // Auto-stop safely outside setState updater when reaching 30 seconds
  useEffect(() => {
    if (stage === 'listening' && elapsedSec >= 30) {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, elapsedSec]);

  if (!isOpen || typeof document === 'undefined' || !document.body) return null;

  const matchAccountId = (
    spokenAccount: string | undefined,
    txType: TransactionType,
    hintText: string
  ): { accountId?: string; accountLabel?: string } => {
    if (spokenAccount && spokenAccount.trim()) {
      const q = spokenAccount.trim().toLowerCase();
      const acc = data.accts.find(
        a =>
          a.name.toLowerCase().includes(q) ||
          q.includes(a.name.toLowerCase()) ||
          (a.bankName && a.bankName.toLowerCase().includes(q))
      );
      if (acc) return { accountId: acc.id, accountLabel: acc.name };

      const card = data.cards.find(
        c =>
          c.name.toLowerCase().includes(q) ||
          q.includes(c.name.toLowerCase()) ||
          c.bank.toLowerCase().includes(q)
      );
      if (card) return { accountId: card.id, accountLabel: `Thẻ ${card.name}` };

      // Alias shortcuts for common VN banks/wallets
      if (q.includes('vcb') || q.includes('vietcombank')) {
        const vcb = data.accts.find(a => a.name.toLowerCase().includes('vietcombank') || a.name.toLowerCase().includes('vcb'));
        if (vcb) return { accountId: vcb.id, accountLabel: vcb.name };
      }
      if (q.includes('tcb') || q.includes('techcombank')) {
        const tcb = data.accts.find(a => a.name.toLowerCase().includes('techcombank') || a.name.toLowerCase().includes('tcb'));
        if (tcb) return { accountId: tcb.id, accountLabel: tcb.name };
      }
    }

    const auto = resolveDefaultPaymentAccountId({
      type: txType,
      text: hintText,
      data,
    });
    if (auto.accountId) {
      const acc = data.accts.find(a => a.id === auto.accountId);
      const card = data.cards.find(c => c.id === auto.accountId);
      return {
        accountId: auto.accountId,
        accountLabel: acc ? acc.name : card ? `Thẻ ${card.name}` : undefined,
      };
    }
    return {};
  };

  const localFallbackParse = (text: string): ParsedVoiceTransaction => {
    const amount = parseVietnameseMoneyText(text);
    const catKey = guessCategoryByText(text);
    const isInc = allIncomeCategories.some(c => c.key === catKey);
    const txType: TransactionType = isInc ? 'in' : 'out';
    const matchedAcc = matchAccountId(undefined, txType, text);
    const cleanedNote = text
      .replace(/\d+([.,]\d+)?\s*(k|nghìn|nghin|ngàn|ngan|tr|triệu|trieu|đ|vnd)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      transcript: text,
      type: txType,
      amount,
      category: catKey || (txType === 'in' ? 'thu_khac' : 'khac'),
      note: cleanedNote ? cleanedNote.charAt(0).toUpperCase() + cleanedNote.slice(1) : text,
      date: getTodayDateString(),
      accountId: matchedAcc.accountId,
      accountLabel: matchedAcc.accountLabel,
    };
  };

  const callVoiceParseApi = async (payload: { audioBase64?: string; mimeType?: string; transcript?: string }) => {
    setStage('processing');
    setErrorMsg(null);

    try {
      const allCats = [
        ...allExpenseCategories.map(c => ({ key: c.key, name: c.name, type: 'out' })),
        ...allIncomeCategories.map(c => ({ key: c.key, name: c.name, type: 'in' })),
      ];

      const res = await fetch('/api/gemini/voice-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          currentDate: getTodayDateString(),
          accounts: data.accts.map(a => ({ id: a.id, name: a.name })),
          cards: data.cards.map(c => ({ id: c.id, name: c.name })),
          categories: allCats,
          savedTrips: (data.settings.savedTrips || []).filter(t => !t.ended).map(t => t.name),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json?.error || 'Không thể phân tích giọng nói');
      }

      const d = json.data;
      const txType: TransactionType = d.type === 'in' ? 'in' : 'out';
      const resolvedCat =
        categoryMap[d.category]
          ? d.category
          : txType === 'in'
          ? 'thu_khac'
          : guessCategoryByText(`${d.transcript || ''} ${d.note || ''}`);

      const matchedAcc = matchAccountId(
        d.account,
        txType,
        `${d.transcript || ''} ${d.note || ''} ${d.location || ''}`
      );

      const validBeneficiary =
        d.beneficiary && ['me', 'spouse', 'child1', 'child2', 'both_children', 'family'].includes(d.beneficiary)
          ? (d.beneficiary as BeneficiaryKey)
          : undefined;

      setParsedResult({
        transcript: d.transcript || payload.transcript || '',
        type: txType,
        amount: Math.max(0, Math.round(Number(d.amount) || 0)),
        category: resolvedCat,
        note: d.note || d.transcript || '',
        date: /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : getTodayDateString(),
        accountId: matchedAcc.accountId,
        accountLabel: matchedAcc.accountLabel || d.account,
        beneficiary: validBeneficiary,
        location: d.location || undefined,
        counterparty: d.counterparty || undefined,
        tripName: d.tripName || undefined,
      });
      setStage('review');
    } catch (err: any) {
      const fallbackText = payload.transcript || liveTranscriptRef.current;
      if (fallbackText && fallbackText.trim()) {
        setParsedResult(localFallbackParse(fallbackText.trim()));
        setStage('review');
        setErrorMsg('AI đang bận — đã phân tích nhanh trên máy. Vui lòng kiểm tra lại số tiền.');
      } else {
        setStage('idle');
        let rawMsg = err?.message || 'Không thể nhận diện giọng nói. Bạn có thể gõ câu nói bên dưới.';
        if (typeof rawMsg === 'string' && rawMsg.trim().startsWith('{')) {
          try {
            const parsedErr = JSON.parse(rawMsg);
            rawMsg = parsedErr?.error?.message || rawMsg;
          } catch {
            // keep rawMsg
          }
        }
        setErrorMsg(rawMsg);
      }
    }
  };

  const sendAudioBlob = (blob: Blob, mimeType: string) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const markerIdx = dataUrl.indexOf(';base64,');
      const pureBase64 = (
        markerIdx !== -1 ? dataUrl.slice(markerIdx + 8) : dataUrl.replace(/^data:[^,]*,/, '')
      ).replace(/\s+/g, '');

      callVoiceParseApi({
        audioBase64: pureBase64,
        mimeType,
        transcript: liveTranscriptRef.current.trim() || undefined,
      });
    };
    reader.onerror = () => {
      if (liveTranscriptRef.current.trim()) {
        callVoiceParseApi({ transcript: liveTranscriptRef.current.trim() });
      } else {
        setStage('idle');
        setErrorMsg('Không thể đọc dữ liệu ghi âm. Vui lòng thử lại.');
      }
    };
    reader.readAsDataURL(blob);
  };

  const finalizeRecordedAudio = (mimeHint?: string) => {
    if (hasFinalizedRef.current) return;
    hasFinalizedRef.current = true;
    isStoppingRef.current = false;

    const pcmChunks = [...pcmChunksRef.current];
    const sampleRate = sampleRateRef.current;
    const chunks = [...audioChunksRef.current];
    const wasWebAudio = usingWebAudioRef.current;
    const cleanMime = (mimeHint || activeMimeRef.current || 'audio/webm').split(';')[0].trim() || 'audio/webm';

    cleanupRecording();

    if (wasWebAudio && pcmChunks.length > 0) {
      const { blob, durationSec, peakAmplitude } = encodeFloat32ChunksToWav(pcmChunks, sampleRate, 16000);
      if (durationSec < 0.25 && !liveTranscriptRef.current.trim()) {
        setStage('idle');
        setErrorMsg('Đoạn ghi âm hơi ngắn. Vui lòng nói trọn câu rồi mới bấm dừng nhé.');
        return;
      }
      if (peakAmplitude < 0.0015 && !liveTranscriptRef.current.trim()) {
        setStage('idle');
        setErrorMsg('Micro không nhận được âm thanh nào. Bạn hãy kiểm tra quyền micro hoặc nói gần điện thoại hơn nhé.');
        return;
      }
      sendAudioBlob(blob, 'audio/wav');
      return;
    }

    if (chunks.length === 0) {
      if (liveTranscriptRef.current.trim()) {
        callVoiceParseApi({ transcript: liveTranscriptRef.current.trim() });
      } else {
        setStage('idle');
        setErrorMsg('Chưa thu được âm thanh. Bạn vui lòng nói gần micro và thử lại.');
      }
      return;
    }

    const blob = new Blob(chunks, { type: cleanMime });
    sendAudioBlob(blob, cleanMime);
  };

  const startRecording = async () => {
    setErrorMsg(null);
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    setElapsedSec(0);
    setMicLevel(0);
    audioChunksRef.current = [];
    pcmChunksRef.current = [];
    hasFinalizedRef.current = false;
    isStoppingRef.current = false;
    usingWebAudioRef.current = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Trình duyệt không hỗ trợ ghi âm trực tiếp. Hãy chọn câu mẫu hoặc gõ câu nói bên dưới.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      // Prefer Web Audio API PCM WAV recording: produces clean 16kHz WAV universally (avoids iOS fragmented MP4 bugs)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      let startedWebAudio = false;
      if (AudioCtx) {
        try {
          const audioCtx = new AudioCtx();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          sampleRateRef.current = audioCtx.sampleRate || 44100;
          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          const muteGain = audioCtx.createGain();
          muteGain.gain.value = 0;

          processor.onaudioprocess = ev => {
            const input = ev.inputBuffer.getChannelData(0);
            pcmChunksRef.current.push(new Float32Array(input));
            let sumSq = 0;
            for (let i = 0; i < input.length; i += 4) {
              sumSq += input[i] * input[i];
            }
            const rms = Math.sqrt(sumSq / Math.max(1, input.length / 4));
            const pct = Math.min(100, Math.round(rms * 420));
            setMicLevel(pct);
          };

          source.connect(processor);
          processor.connect(muteGain);
          muteGain.connect(audioCtx.destination);

          audioContextRef.current = audioCtx;
          mediaSourceRef.current = source;
          scriptProcessorRef.current = processor;
          muteGainRef.current = muteGain;
          activeMimeRef.current = 'audio/wav';
          usingWebAudioRef.current = true;
          startedWebAudio = true;
        } catch (webAudioErr) {
          console.warn('Web Audio PCM init failed, falling back to MediaRecorder:', webAudioErr);
          usingWebAudioRef.current = false;
        }
      }

      if (!startedWebAudio) {
        const mimeCandidates = isIOS
          ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
          : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

        const supportedMime =
          typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
            ? mimeCandidates.find(m => MediaRecorder.isTypeSupported(m))
            : undefined;

        const recorder = supportedMime
          ? new MediaRecorder(stream, { mimeType: supportedMime })
          : new MediaRecorder(stream);

        activeMimeRef.current = (recorder.mimeType || supportedMime || (isIOS ? 'audio/mp4' : 'audio/webm')).split(';')[0].trim();
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          finalizeRecordedAudio(recorder.mimeType || supportedMime);
        };

        // Start WITHOUT timeslice so browsers emit one complete self-contained audio file on stop
        recorder.start();
      }

      // Skip concurrent Web Speech API on iOS because iOS WebKit locks/conflicts audio sessions
      if (!isIOS) {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          try {
            const rec = new SpeechRec();
            rec.lang = 'vi-VN';
            rec.continuous = true;
            rec.interimResults = true;
            rec.onresult = (ev: any) => {
              let text = '';
              for (let i = 0; i < ev.results.length; i++) {
                text += ev.results[i][0].transcript + ' ';
              }
              const clean = text.trim();
              liveTranscriptRef.current = clean;
              setLiveTranscript(clean);
            };
            rec.onerror = () => {
              // Ignore silently; PCM WAV + Gemini audio handles transcription
            };
            rec.start();
            speechRecRef.current = rec;
          } catch {
            // ignore
          }
        }
      }

      setStage('listening');

      timerRef.current = window.setInterval(() => {
        setElapsedSec(prev => (prev < 30 ? prev + 1 : 30));
      }, 1000);
    } catch (err: any) {
      cleanupRecording();
      setStage('idle');
      setErrorMsg(
        err?.name === 'NotAllowedError'
          ? 'Bạn chưa cấp quyền micro. Vui lòng cho phép micro hoặc nhập/chọn câu mẫu bên dưới.'
          : 'Không thể khởi động micro. Bạn có thể gõ câu nói hoặc chọn câu mẫu bên dưới.'
      );
    }
  };

  const stopRecording = () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        // ignore
      }
      speechRecRef.current = null;
    }

    // Immediate UI transition so user sees instant stop feedback
    setStage('processing');

    if (usingWebAudioRef.current) {
      finalizeRecordedAudio('audio/wav');
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      const mime = recorder.mimeType || activeMimeRef.current;
      stopWatchdogRef.current = window.setTimeout(() => {
        finalizeRecordedAudio(mime);
      }, 900);

      try {
        recorder.stop();
      } catch {
        finalizeRecordedAudio(mime);
      }
    } else {
      finalizeRecordedAudio(activeMimeRef.current);
    }
  };

  const cancelRecording = () => {
    hasFinalizedRef.current = true;
    isStoppingRef.current = false;
    cleanupRecording();
    audioChunksRef.current = [];
    pcmChunksRef.current = [];
    liveTranscriptRef.current = '';
    setLiveTranscript('');
    setElapsedSec(0);
    setStage('idle');
  };

  const handleConfirmSave = () => {
    if (!parsedResult || parsedResult.amount <= 0) return;

    addTransaction({
      type: parsedResult.type,
      cat: parsedResult.category,
      amount: parsedResult.amount,
      date: parsedResult.date || getTodayDateString(),
      note: parsedResult.note || undefined,
      accountId: parsedResult.accountId,
      beneficiary: parsedResult.type === 'out' ? parsedResult.beneficiary || 'family' : undefined,
      tripName: parsedResult.tripName?.trim() || undefined,
      counterparty: parsedResult.counterparty?.trim() || undefined,
      location: parsedResult.location?.trim() || undefined,
    });

    // Remember newly mentioned trip/contact in settings automatically
    const curTrips = data.settings.savedTrips || [];
    const curContacts = data.settings.savedContacts || [];
    let settingsUpdates: any = {};
    if (
      parsedResult.tripName?.trim() &&
      !curTrips.some(t => t.name.toLowerCase() === parsedResult.tripName!.trim().toLowerCase())
    ) {
      settingsUpdates.savedTrips = [
        ...curTrips,
        { id: 'trip_' + Date.now().toString(36), name: parsedResult.tripName.trim(), ended: false },
      ];
    }
    if (
      parsedResult.counterparty?.trim() &&
      !curContacts.some(c => c.toLowerCase() === parsedResult.counterparty!.trim().toLowerCase())
    ) {
      settingsUpdates.savedContacts = [...curContacts, parsedResult.counterparty.trim()];
    }
    if (Object.keys(settingsUpdates).length > 0) {
      updateSettings(settingsUpdates);
    }

    setSavedNotice(true);
    setTimeout(() => {
      onClose();
    }, 650);
  };

  const formatTimer = (sec: number) => `00:${String(sec).padStart(2, '0')}`;

  const resolveValidVoiceCategory = (catKey: string | undefined, txType: TransactionType): string => {
    const list = txType === 'out' ? allExpenseCategories : allIncomeCategories;
    if (catKey && list.some(c => c.key === catKey)) return catKey;
    return txType === 'out' ? 'an_uong' : 'thu_khac';
  };

  const renderVoiceCategoryOptions = (txType: TransactionType) => {
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

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header aligned with Emerald-Teal-Cyan theme */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-800 dark:via-teal-800 dark:to-cyan-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center">
              <Mic size={19} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold leading-tight">
                Ghi Chép Bằng Giọng Nói
              </h2>
              <p className="text-[11px] text-emerald-100">
                Nói tự nhiên — AI tự điền số tiền, danh mục & tài khoản
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              cleanupRecording();
              onClose();
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5 space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-200">
              {errorMsg}
            </div>
          )}

          {/* Stage: IDLE or LISTENING */}
          {(stage === 'idle' || stage === 'listening') && (
            <>
              {/* Guidance bubble inspired by MISA */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 text-center space-y-2">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-1.5">
                  <Volume2 size={15} />
                  <span>Gợi ý mẫu câu nói tự nhiên</span>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                  "VD: Hôm nay tôi đi siêu thị hết một trăm nghìn từ tài khoản Vietcombank"
                </p>
              </div>

              {/* Center Interactive Mic Button */}
              <div className="flex flex-col items-center justify-center py-3 space-y-4">
                <div className="relative flex items-center justify-center">
                  {stage === 'listening' && (
                    <>
                      <span className="pointer-events-none absolute w-32 h-32 rounded-full bg-emerald-400/20 animate-ping" />
                      <span className="pointer-events-none absolute w-28 h-28 rounded-full border-2 border-emerald-400/50" />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={stage === 'listening' ? stopRecording : startRecording}
                    className={`relative z-20 w-24 h-24 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all active:scale-95 cursor-pointer touch-manipulation select-none ${
                      stage === 'listening'
                        ? 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/35'
                        : 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 shadow-emerald-600/35 hover:brightness-105'
                    }`}
                  >
                    {stage === 'listening' ? (
                      <>
                        <Square size={26} fill="currentColor" className="pointer-events-none" />
                        <span className="text-[11px] font-bold mt-1 tabular-nums pointer-events-none">
                          {formatTimer(elapsedSec)}
                        </span>
                      </>
                    ) : (
                      <Mic size={34} strokeWidth={2.2} className="pointer-events-none" />
                    )}
                  </button>
                </div>

                <div className="text-center space-y-2 w-full">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {stage === 'listening'
                      ? 'Đang nghe bạn nói... Chạm nút đỏ để hoàn tất'
                      : 'Chạm vào micro để bắt đầu nói'}
                  </p>
                  {stage === 'listening' && (
                    <div className="flex items-center justify-center gap-1 h-5 pt-0.5" aria-hidden="true">
                      {[0.4, 0.75, 1, 0.75, 0.4].map((weight, idx) => {
                        const h = Math.max(4, Math.round(4 + (micLevel / 100) * 16 * weight));
                        return (
                          <span
                            key={idx}
                            className="w-1.5 rounded-full bg-rose-500 transition-all duration-75"
                            style={{ height: `${h}px` }}
                          />
                        );
                      })}
                    </div>
                  )}
                  {stage === 'listening' && liveTranscript && (
                    <div className="mt-2 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 max-w-sm mx-auto">
                      "{liveTranscript}"
                    </div>
                  )}
                  {stage === 'listening' && (
                    <div className="flex items-center justify-center gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold shadow-md shadow-rose-500/25 flex items-center gap-2 active:scale-95 transition-all cursor-pointer touch-manipulation"
                      >
                        <Square size={15} fill="currentColor" />
                        <span>Dừng & Phân tích ngay</span>
                      </button>
                      <button
                        type="button"
                        onClick={cancelRecording}
                        className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold active:scale-95 transition-all cursor-pointer touch-manipulation"
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sample phrases quick tap & fallback text box */}
              {stage === 'idle' && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Hoặc gõ nhanh câu nói để AI điền:
                    </span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={manualText}
                        onChange={e => setManualText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && manualText.trim()) {
                            e.preventDefault();
                            callVoiceParseApi({ transcript: manualText.trim() });
                          }
                        }}
                        placeholder="VD: Hôm nay ăn phở 55k bằng MoMo..."
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                      <button
                        type="button"
                        disabled={!manualText.trim()}
                        onClick={() => callVoiceParseApi({ transcript: manualText.trim() })}
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Send size={14} />
                        <span>Phân tích</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Chạm câu mẫu để thử ngay:
                    </span>
                    <div className="space-y-1.5">
                      {VOICE_EXAMPLES.map(ex => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => callVoiceParseApi({ transcript: ex })}
                          className="w-full text-left px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          "{ex}"
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Stage: PROCESSING */}
          {stage === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Đang phân tích giọng nói...
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Đang bóc tách số tiền, hạng mục và tài khoản thanh toán
                </p>
              </div>
            </div>
          )}

          {/* Stage: REVIEW */}
          {stage === 'review' && parsedResult && (
            <div className="space-y-4">
              {/* Heard Transcript */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Sparkles size={12} className="text-emerald-600" />
                  <span>Nội dung đã nhận diện</span>
                </span>
                <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 italic">
                  "{parsedResult.transcript}"
                </p>
              </div>

              {/* Extracted Structured Card */}
              <div className="rounded-3xl border border-emerald-200/80 dark:border-emerald-800/60 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon catKey={parsedResult.category} size="lg" />
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        {categoryMap[parsedResult.category]?.name || 'Giao dịch'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {parsedResult.note}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-lg sm:text-xl font-black tabular-nums ${
                        parsedResult.type === 'in'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-500'
                      }`}
                    >
                      {parsedResult.type === 'in' ? '+' : '-'}
                      {formatVND(parsedResult.amount)}
                    </span>
                    <p className="text-[11px] text-slate-400">{parsedResult.date}</p>
                  </div>
                </div>

                {/* Secondary metadata tags using clean · separators */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {parsedResult.accountLabel && (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Wallet size={13} className="text-emerald-600" />
                      {parsedResult.accountLabel}
                    </span>
                  )}
                  {parsedResult.counterparty && (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Users size={13} className="text-teal-600" />
                      {parsedResult.counterparty}
                    </span>
                  )}
                  {parsedResult.location && (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <MapPin size={13} className="text-cyan-600" />
                      {parsedResult.location}
                    </span>
                  )}
                  {parsedResult.tripName && (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Compass size={13} className="text-amber-600" />
                      {parsedResult.tripName}
                    </span>
                  )}
                </div>

                {/* Inline Quick Type & Category Edit (shows ALL built-in + custom categories) */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setParsedResult(prev => prev ? {
                          ...prev,
                          type: 'out',
                          category: resolveValidVoiceCategory(prev.type === 'out' ? prev.category : undefined, 'out'),
                        } : null);
                      }}
                      className={`min-h-[38px] py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        parsedResult.type === 'out'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Chi tiền
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setParsedResult(prev => prev ? {
                          ...prev,
                          type: 'in',
                          category: resolveValidVoiceCategory(prev.type === 'in' ? prev.category : undefined, 'in'),
                        } : null);
                      }}
                      className={`min-h-[38px] py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        parsedResult.type === 'in'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Thu tiền
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Đổi danh mục nhanh
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-2.5 pointer-events-none">
                        <CategoryIcon catKey={resolveValidVoiceCategory(parsedResult.category, parsedResult.type)} size="sm" />
                      </div>
                      <select
                        value={resolveValidVoiceCategory(parsedResult.category, parsedResult.type)}
                        onChange={e => {
                          const val = e.target.value;
                          setParsedResult(prev => prev ? { ...prev, category: val } : null);
                        }}
                        className="w-full min-h-[42px] bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-8 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer truncate"
                      >
                        {renderVoiceCategoryOptions(parsedResult.type)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {savedNotice ? (
                <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-center font-bold text-sm flex items-center justify-center gap-2">
                  <Check size={18} />
                  <span>Đã ghi giao dịch vào sổ thành công!</span>
                </div>
              ) : (
                <div className="space-y-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom,12px))]">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStage('idle');
                        setParsedResult(null);
                      }}
                      className="px-3.5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw size={15} />
                      <span>Nói lại</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onEditInFullModal(parsedResult);
                        onClose();
                      }}
                      className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 size={15} />
                      <span>Mở form chỉnh sửa</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={parsedResult.amount <= 0}
                    onClick={handleConfirmSave}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check size={18} strokeWidth={2.5} />
                    <span>Lưu Giao Dịch Ngay</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
