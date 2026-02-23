import { useCallback, useEffect } from "react";
import { setupApiInterceptors } from "../../../sync/api";
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
  setAccessToken: (token: string | null) => void;
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
    const interval = setInterval(syncTokenFromStorage, 1000);

    return () => {
      window.removeEventListener("storage", syncTokenFromStorage);
      clearInterval(interval);
    };
  }, [accessToken, dispatch]);
}

export function useAuth(): AuthContextValue {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((s) => s.auth.accessToken);

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

  return {
    accessToken: accessToken ?? null,
    setAccessToken,
    login: doLogin,
    signUp: doSignUp,
    logout,
  };
}
