import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Github,
  Eye,
  EyeOff,
  GitCommit,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Download,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const GH_TOKEN_STORAGE_KEY = 'sothuchi.github_pat';

interface GitHubPushModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubPushModal: React.FC<GitHubPushModalProps> = ({ isOpen, onClose }) => {
  const [githubToken, setGithubToken] = useState<string>(() => {
    try {
      return localStorage.getItem(GH_TOKEN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [rememberOnDevice, setRememberOnDevice] = useState<boolean>(true);
  const [hasServerToken, setHasServerToken] = useState<boolean>(false);
  const [showToken, setShowToken] = useState<boolean>(false);
  const [commitMessage, setCommitMessage] = useState<string>(
    'Nâng cấp Sổ Thu Chi (Đồng bộ Đám mây + React 19 + AI Gemini)'
  );
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/github/status')
      .then(r => (r.ok ? r.json() : { hasServerToken: false }))
      .then(json => setHasServerToken(Boolean(json?.hasServerToken)))
      .catch(() => setHasServerToken(false));
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined' || !document.body) return null;

  const canPush = hasServerToken || githubToken.trim().length > 0;

  const handleClearSavedToken = () => {
    setGithubToken('');
    try {
      localStorage.removeItem(GH_TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handlePushToGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPush) return;

    const cleanLocal = githubToken.trim();
    if (cleanLocal && rememberOnDevice) {
      try {
        localStorage.setItem(GH_TOKEN_STORAGE_KEY, cleanLocal);
      } catch {
        // ignore
      }
    }

    setIsPushing(true);
    setPushStatus(null);

    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cleanLocal,
          repoOwner: 'duongphamwork93',
          repoName: 'so-thu-chi',
          branch: 'main',
          commitMsg: commitMessage.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể đẩy lên GitHub');
      }

      setPushStatus({
        type: 'success',
        message: json.message,
        details: json.details,
      });

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      setPushStatus({
        type: 'error',
        message: err.message || 'Lỗi khi cập nhật lên GitHub',
      });
    } finally {
      setIsPushing(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center">
              <Github size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Cập Nhật Lên GitHub
              </h2>
              <span className="text-[11px] text-slate-400">
                Kho lưu trữ: duongphamwork93/so-thu-chi
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {hasServerToken && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-200">
              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Đã lưu sẵn Token GitHub bảo mật trên máy chủ</p>
                <p className="text-[11px] opacity-85 mt-0.5">
                  Bạn không cần dán lại mã mỗi lần dùng — chỉ cần bấm nút <strong>Đẩy Thẳng Lên GitHub Ngay</strong> bên dưới.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handlePushToGithub} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {hasServerToken
                    ? 'Token GitHub khác (để trống để dùng mã đã lưu sẵn):'
                    : 'Dán mã GitHub Personal Access Token (PAT) vào đây:'}
                </label>
                {githubToken && (
                  <button
                    type="button"
                    onClick={handleClearSavedToken}
                    className="text-[11px] text-rose-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Trash2 size={11} />
                    <span>Xóa mã trên máy</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  required={!hasServerToken}
                  value={githubToken}
                  onChange={e => setGithubToken(e.target.value)}
                  placeholder={
                    hasServerToken
                      ? '•••••••• (Đang dùng mã đã lưu an toàn trên máy chủ)'
                      : 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 pr-10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberOnDevice}
                    onChange={e => setRememberOnDevice(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Lưu mã này trên trình duyệt của tôi</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  Quyền <code className="text-emerald-600 font-mono">repo</code>
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Ghi chú commit:
              </label>
              <input
                type="text"
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPushing || !canPush}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <GitCommit size={18} />
              <span>
                {isPushing
                  ? 'Đang đóng gói và đẩy code lên GitHub...'
                  : 'Đẩy Thẳng Lên GitHub Ngay'}
              </span>
            </button>
          </form>

          {/* Status Alert */}
          {pushStatus && (
            <div
              className={`p-3.5 rounded-2xl text-xs space-y-1.5 ${
                pushStatus.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {pushStatus.type === 'success' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertTriangle size={18} />
                )}
                <span>{pushStatus.message}</span>
              </div>
              {pushStatus.details && (
                <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-24 overflow-y-auto bg-black/10 dark:bg-black/30 p-2 rounded-lg text-slate-700 dark:text-slate-300">
                  {pushStatus.details}
                </pre>
              )}
            </div>
          )}

          {/* Quick instructions */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
            <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>Cách lấy Token GitHub:</span>
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>Mở trang tạo Token</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <li>
                Mở <strong className="text-slate-800 dark:text-slate-200">GitHub Settings</strong> →{' '}
                <strong className="text-slate-800 dark:text-slate-200">Developer settings</strong> →{' '}
                <strong className="text-slate-800 dark:text-slate-200">Personal access tokens (classic)</strong>.
              </li>
              <li>
                Bấm <strong className="text-slate-800 dark:text-slate-200">Generate new token (classic)</strong>.
              </li>
              <li>
                Tích chọn ô quyền <strong className="text-emerald-600 font-bold">repo</strong> rồi bấm nút Generate.
              </li>
              <li>Sao chép token dán vào ô bên trên (chỉ cần dán 1 lần, máy tự ghi nhớ).</li>
            </ol>
          </div>

          {/* Download alternatives */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-500">Hoặc tải file về máy:</span>
            <a
              href="/api/download/source"
              download="so-thu-chi-source.zip"
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
            >
              <Download size={13} />
              <span>Tải file ZIP mã nguồn</span>
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
