import React, { createContext, useCallback, useEffect, useState } from "react";
import { login, register } from "../../../sync/auth";
import { setupApiInterceptors } from "../../../sync/api";

export interface AuthContextValue {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  onAfterLogin?: (token: string) => Promise<void>;
}

export function AuthProvider({ children, onAfterLogin }: AuthProviderProps) {
  const [accessToken, setAccessTokenState] = useState<string | null>(() =>
    localStorage.getItem("accessToken")
  );

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  }, []);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const res = await login(email, password);
      setAccessToken(res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);
      await onAfterLogin?.(res.accessToken);
    },
    [setAccessToken, onAfterLogin]
  );

  const handleSignUp = useCallback(
    async (email: string, password: string) => {
      const res = await register(email, password);
      setAccessToken(res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);
      await onAfterLogin?.(res.accessToken);
    },
    [setAccessToken, onAfterLogin]
  );

  const logout = useCallback(() => {
    setAccessToken(null);
  }, [setAccessToken]);

  // Настраиваем глобальный обработчик 401 ошибок
  useEffect(() => {
    setupApiInterceptors(logout);
  }, [logout]);

  // Синхронизация состояния токена с localStorage
  // (на случай, если interceptor обновил токен)
  useEffect(() => {
    const syncTokenFromStorage = () => {
      const storedToken = localStorage.getItem("accessToken");
      if (storedToken !== accessToken) {
        setAccessTokenState(storedToken);
      }
    };

    // Проверяем при монтировании
    syncTokenFromStorage();

    // Слушаем изменения в localStorage (для синхронизации между вкладками)
    window.addEventListener("storage", syncTokenFromStorage);

    // Периодическая проверка (на случай обновления токена interceptor'ом)
    const interval = setInterval(syncTokenFromStorage, 1000);

    return () => {
      window.removeEventListener("storage", syncTokenFromStorage);
      clearInterval(interval);
    };
  }, [accessToken]);

  const value: AuthContextValue = {
    accessToken: accessToken ?? null,
    setAccessToken,
    login: handleLogin,
    signUp: handleSignUp,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
