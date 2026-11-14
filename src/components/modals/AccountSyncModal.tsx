import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Cloud,
  CloudOff,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Smartphone,
  Laptop,
  AlertTriangle,
  UploadCloud,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import firebaseConfig from '../../../firebase-applet-config.json';

interface AccountSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSyncModal: React.FC<AccountSyncModalProps> = ({ isOpen, onClose }) => {
  const { user, authLoading, authError, authErrorCode, signInWithGoogle, signOutUser, clearAuthError } =
    useAuth();
  const [copiedHost, setCopiedHost] = useState(false);
  const {
    data,
    syncStatus,
    syncError,
    lastSyncedAt,
    pendingLocalMigrationCount,
    mergeLocalToCloud,
    dismissLocalMigration,
    forceUploadAllToCloud,
  } = useFinance();

  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen || typeof document === 'undefined' || !document.body) return null;

  const handleLogin = async () => {
    clearAuthError();
    const ok = await signInWithGoogle();
    if (ok) {
      setNotice('Đăng nhập thành công! Dữ liệu đang được đồng bộ tự động.');
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleForceUpload = async () => {
    const ok = await forceUploadAllToCloud();
    if (ok) {
      setNotice('Đã đẩy toàn bộ dữ liệu trên máy này lên tài khoản Đám mây!');
      setTimeout(() => setNotice(null), 3500);
    }
  };

  const handleMergeLocal = async () => {
    const ok = await mergeLocalToCloud();
    if (ok) {
      setNotice('Đã gộp thành công dữ liệu từ máy này vào tài khoản Đám mây!');
      setTimeout(() => setNotice(null), 3500);
    }
  };

  const formatTime = (ts: number | null) => {
    if (!ts) return 'Vừa xong';
    try {
      return new Date(ts).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'Vừa xong';
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[86vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Cloud size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Đồng Bộ Điện Thoại & Máy Tính
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Đăng nhập 1 tài khoản Google để dùng chung dữ liệu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {notice && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {(authError || syncError) && (() => {
            const rawErr = authError || syncError || '';
            let headline = rawErr;
            let detail = '';
            if (rawErr.startsWith('{')) {
              try {
                const parsed = JSON.parse(rawErr);
                if (parsed?.error) {
                  headline = `Không thể đồng bộ dữ liệu: ${parsed.error}`;
                  detail = `Thao tác: ${parsed.operationType || 'sync'} (${parsed.path || 'cloud'})`;
                }
              } catch {
                // keep rawErr
              }
            }
            return (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs space-y-2.5 overflow-hidden">
                <div className="font-semibold flex items-start gap-2 min-w-0">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="break-words">{headline}</p>
                    {detail && (
                      <p className="text-[11px] font-normal opacity-80 break-all">{detail}</p>
                    )}
                  </div>
                </div>

                {authErrorCode === 'auth/unauthorized-domain' && typeof window !== 'undefined' && (
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-rose-200/80 dark:border-rose-800/70 text-slate-700 dark:text-slate-200 space-y-2">
                  <p className="font-bold text-[11px] text-slate-900 dark:text-white">
                    Cách mở khóa đăng nhập trên tên miền này (chỉ làm 1 lần, mất 15 giây):
                  </p>
                  <div className="flex items-center justify-between gap-2 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg">
                    <code className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 truncate">
                      {window.location.hostname}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(window.location.hostname);
                        setCopiedHost(true);
                        setTimeout(() => setCopiedHost(false), 2000);
                      }}
                      className="text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:text-emerald-600 flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Copy size={12} />
                      <span>{copiedHost ? 'Đã chép' : 'Chép'}</span>
                    </button>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    <li>Bấm nút mở Firebase Console bên dưới.</li>
                    <li>Chọn mục <strong>Authorized domains</strong> → bấm <strong>Add domain</strong>.</li>
                    <li>Dán <code className="font-mono">{window.location.hostname}</code> rồi bấm <strong>Add</strong>.</li>
                  </ol>
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5"
                  >
                    <span>Mở Firebase Console để thêm tên miền</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
              </div>
            );
          })()}

          {!user ? (
            <div className="space-y-4">
              {/* Illustration box */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-800/70 border border-emerald-200/70 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-center gap-3 py-1">
                  <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center text-emerald-600">
                    <Smartphone size={22} />
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <RefreshCw size={16} />
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600">
                    <Laptop size={22} />
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Ghi sổ trên điện thoại — Xem ngay trên máy tính
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Hiện bạn đang có{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {data.records.length} giao dịch
                    </strong>{' '}
                    và{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {data.accts.length} tài khoản
                    </strong>{' '}
                    trên máy này. Khi đăng nhập Google lần đầu, dữ liệu này sẽ tự động được đưa lên Đám mây.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogin}
                disabled={authLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
              >
                {authLoading ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                  </svg>
                )}
                <span>{authLoading ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google'}</span>
              </button>

              <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                Dữ liệu tài chính được mã hóa riêng tư theo tài khoản Google của bạn. Chỉ mình bạn xem được.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Logged in user card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    className="w-11 h-11 rounded-full border-2 border-emerald-500 object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {user.displayName || 'Tài khoản Google'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {syncStatus === 'syncing' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        <RefreshCw size={11} className="animate-spin" />
                        <span>Đang đồng bộ...</span>
                      </span>
                    ) : syncStatus === 'error' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                        <CloudOff size={11} />
                        <span>Lỗi đồng bộ</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={11} />
                        <span>Đã đồng bộ • {formatTime(lastSyncedAt)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Pending local migration prompt */}
              {pendingLocalMigrationCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 space-y-2.5">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Phát hiện {pendingLocalMigrationCount} mục cũ trên máy này chưa có trên Đám mây
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    Bạn có muốn gộp các giao dịch/tài sản cũ trên thiết bị này vào tài khoản Google không?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleMergeLocal}
                      className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Gộp lên Đám mây
                    </button>
                    <button
                      type="button"
                      onClick={dismissLocalMigration}
                      className="py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-semibold cursor-pointer"
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
              )}

              {/* Current synced summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <p className="text-base font-black text-slate-900 dark:text-white">
                    {data.records.length}
                  </p>
                  <p className="text-[10px] text-slate-500">Giao dịch</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <p className="text-base font-black text-slate-900 dark:text-white">
                    {data.accts.length + data.cards.length}
                  </p>
                  <p className="text-[10px] text-slate-500">Ví & Thẻ</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <p className="text-base font-black text-slate-900 dark:text-white">
                    {data.deps.length + data.holds.length}
                  </p>
                  <p className="text-[10px] text-slate-500">Tiết kiệm/ĐT</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                Hãy mở trang web này trên <strong>điện thoại</strong> hoặc <strong>máy tính khác</strong> và đăng nhập đúng email <strong>{user.email}</strong>, mọi dữ liệu sẽ tự động khớp 100%!
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleForceUpload}
                  disabled={syncStatus === 'syncing'}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-95 transition-all"
                >
                  <UploadCloud size={15} />
                  <span>Đồng bộ lại ngay</span>
                </button>

                <button
                  type="button"
                  onClick={signOutUser}
                  disabled={authLoading}
                  className="py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <LogOut size={15} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
