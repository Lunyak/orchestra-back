import { useCallback, useEffect } from "react";
import { setupApiInterceptors, AUTH_TOKEN_SYNC_EVENT } from "../../../sync/api/client";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  authActions,
  authLogin,
  authLogout,
  authSignUp,
  type AfterLoginCallback,
} from "./auth-slice";

export interface AuthContextValue {
  accessToken: string | null;
  offlineMode: boolean;
  setAccessToken: (token: string | null) => void;
  enterDesktopOffline: () => void;
  login: (
    email: string,
    password: string,
    onAfterLogin?: AfterLoginCallback,
  ) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    onAfterLogin?: AfterLoginCallback,
  ) => Promise<void>;
  logout: () => void;
}

/**
 * Инициализация auth-сайдэффектов (без React Context):
 * - глобальный 401 handler через axios interceptor
 * - синхронизация accessToken из localStorage (refresh interceptor обновляет storage)
 */
export function useAuthBootstrap() {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  const doLogout = useCallback(() => {
    void dispatch(authLogout());
  }, [dispatch]);

  useEffect(() => {
    setupApiInterceptors(doLogout);
  }, [doLogout]);

  useEffect(() => {
    const syncTokenFromStorage = () => {
      const storedToken = localStorage.getItem("accessToken");
      if (storedToken !== accessToken) {
        dispatch(authActions.setAccessTokenState(storedToken));
      }
    };

    syncTokenFromStorage();
    window.addEventListener("storage", syncTokenFromStorage);
    window.addEventListener(AUTH_TOKEN_SYNC_EVENT, syncTokenFromStorage);
    window.addEventListener("focus", syncTokenFromStorage);

    return () => {
      window.removeEventListener("storage", syncTokenFromStorage);
      window.removeEventListener(AUTH_TOKEN_SYNC_EVENT, syncTokenFromStorage);
      window.removeEventListener("focus", syncTokenFromStorage);
    };
  }, [accessToken, dispatch]);
}

export function useAuth(): AuthContextValue {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const offlineMode = useAppSelector((s) => s.auth.offlineMode);

  const setAccessToken = useCallback(
    (token: string | null) => {
      if (token) {
        localStorage.setItem("accessToken", token);
      } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      }
      dispatch(authActions.setAccessTokenState(token));
    },
    [dispatch],
  );

  const doLogin = useCallback(
    async (email: string, password: string, onAfterLogin?: AfterLoginCallback) => {
      await dispatch(authLogin({ email, password, onAfterLogin })).unwrap();
    },
    [dispatch],
  );

  const doSignUp = useCallback(
    async (email: string, password: string, onAfterLogin?: AfterLoginCallback) => {
      await dispatch(authSignUp({ email, password, onAfterLogin })).unwrap();
    },
    [dispatch],
  );

  const logout = useCallback(() => {
    void dispatch(authLogout());
  }, [dispatch]);

  const enterDesktopOffline = useCallback(() => {
    dispatch(authActions.enterDesktopOffline());
  }, [dispatch]);

  return {
    accessToken: accessToken ?? null,
    offlineMode: Boolean(offlineMode),
    setAccessToken,
    enterDesktopOffline,
    login: doLogin,
    signUp: doSignUp,
    logout,
  };
}
