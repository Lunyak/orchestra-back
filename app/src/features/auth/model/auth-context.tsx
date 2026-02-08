import React, { createContext, useCallback, useState } from "react";
import { login, register } from "../../../sync/auth";

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
