import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthContextType {
  user: User | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  authErrorCode: string | null;
  signInWithGoogle: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthErrorCode(null);
    try {
      await signInWithPopup(auth, googleProvider);
      return true;
    } catch (err: any) {
      const code = err?.code || '';
      setAuthErrorCode(code);
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Bạn đã đóng cửa sổ đăng nhập Google.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'Trình duyệt đang chặn cửa sổ đăng nhập (Popup). Vui lòng cho phép mở popup cho trang web này rồi bấm thử lại.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setAuthError(
          `Tên miền "${host}" chưa được cấp phép trong Firebase Console (Authorized Domains).`
        );
      } else {
        setAuthError(err?.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
      }
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const signOutUser = async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthErrorCode(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      setAuthError(err?.message || 'Không thể đăng xuất.');
    } finally {
      setAuthLoading(false);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
    setAuthErrorCode(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        authLoading,
        authError,
        authErrorCode,
        signInWithGoogle,
        signOutUser,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
