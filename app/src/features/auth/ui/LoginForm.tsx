import "./login.css";
import { isAxiosError } from "axios";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "../../../sync/api/client";
import { forgotPassword } from "../../../sync/auth";
import { useAuth } from "../model/auth-context";

export function LoginForm({
  onAfterLogin,
}: {
  onAfterLogin?: (token: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login: doLogin, signUp, enterDesktopOffline } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(
    searchParams.get("register") === "1",
  );
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const apiBase = getApiBaseUrl();
  const isDesktop = import.meta.env.MODE === "desktop";
  const passwordAutoComplete = isRegisterMode ? "new-password" : "current-password";

  const formatAuthError = (err: unknown): string => {
    if (isAxiosError(err) && !err.response) {
      return `Сервер недоступен (${apiBase}). Проверьте интернет и адрес API.`;
    }
    const msg =
      err &&
      typeof err === "object" &&
      "response" in err &&
      (err as { response?: { data?: { message?: string } } }).response?.data
        ?.message;
    return typeof msg === "string" ? msg : "Ошибка входа";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (isResetMode) return;
    try {
      const emailNorm = email.trim().toLowerCase();
      if (isRegisterMode) {
        if (!acceptLegal) {
          setError(
            "Нужно принять соглашение и политику, чтобы создать аккаунт",
          );
          return;
        }
        try {
          localStorage.setItem("legalAcceptedAt", new Date().toISOString());
          localStorage.setItem("legalAcceptedVersion", "1.0");
        } catch {}
        await signUp(emailNorm, password, onAfterLogin);
      } else {
        await doLogin(emailNorm, password, onAfterLogin);
      }
    } catch (err: unknown) {
      setError(formatAuthError(err));
    }
  };

  return (
    <div className="app-layout login-layout">
      <form className="login-form" onSubmit={handleSubmit}>
        <p className="login-form__brand">
          <Link className="login-form__link" to="/">
            Orchestra
          </Link>
        </p>
        <h1 className="login-form__title">
          {isResetMode
            ? "Сброс пароля"
            : isRegisterMode
              ? "Регистрация"
              : "Вход"}
        </h1>
        <p className="login-form-subtitle">
          {isResetMode
            ? "Укажи email аккаунта — пришлём ссылку для смены пароля."
            : isRegisterMode
              ? "Создай аккаунт, чтобы работать с проектами и сценарием на этом устройстве."
              : "Войди в аккаунт, чтобы работать с проектами и сценарием на этом устройстве."}
        </p>
        {isDesktop ? (
          <p className="login-api-hint">
            API
            <span className="login-api-url">{apiBase}</span>
          </p>
        ) : null}

        <label className="login-form__label">
          Email
          <input
            className="login-form__input"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {isResetMode ? (
          <>
            <button
              type="button"
              className="login-form__btn login-form__btn--submit"
              disabled={!email.trim() || resetLoading}
              onClick={async () => {
                setError(null);
                setMessage(null);
                const emailNorm = email.trim().toLowerCase();
                if (!emailNorm) return;
                setResetLoading(true);
                try {
                  const res = await forgotPassword(emailNorm);
                  if (res?.token) {
                    navigate(
                      `/reset-password?token=${encodeURIComponent(res.token)}`,
                    );
                    return;
                  }
                  setMessage(
                    "Если такой email зарегистрирован, на почту ушло письмо со ссылкой. Проверьте папку «Спам».",
                  );
                } catch (err: unknown) {
                  setError(formatAuthError(err));
                } finally {
                  setResetLoading(false);
                }
              }}
            >
              {resetLoading ? "…" : "Отправить ссылку"}
            </button>
            <button
              type="button"
              className="login-form__btn login-form__btn--secondary"
              onClick={() => {
                setIsResetMode(false);
                setError(null);
                setMessage(null);
              }}
            >
              Назад к входу
            </button>
          </>
        ) : (
          <>
            <label className="login-form__label">
              Пароль
              <input
                className="login-form__input"
                type="password"
                name="password"
                autoComplete={passwordAutoComplete}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {isRegisterMode ? (
              <LabeledCheckbox
                checked={acceptLegal}
                onChange={setAcceptLegal}
                className="login__assign-policy"
              >
                <span>
                  Я принимаю{" "}
                  <a className="login-form__link" href="/terms" target="_blank" rel="noreferrer">
                    Пользовательское соглашение
                  </a>{" "}
                  и ознакомлен(а) с{" "}
                  <a className="login-form__link" href="/privacy" target="_blank" rel="noreferrer">
                    Политикой обработки персональных данных
                  </a>
                  .
                </span>
              </LabeledCheckbox>
            ) : null}
            <button
              type="submit"
              className="login-form__btn login-form__btn--submit"
              disabled={isRegisterMode && !acceptLegal}
            >
              {isRegisterMode ? "Создать аккаунт" : "Войти"}
            </button>
            <button
              type="button"
              className="login-form__btn login-form__btn--secondary"
              onClick={() => {
                setError(null);
                setMessage(null);
                setAcceptLegal(false);
                setIsRegisterMode((prev) => !prev);
              }}
            >
              {isRegisterMode
                ? "У меня уже есть аккаунт"
                : "Создать новый аккаунт"}
            </button>
            {!isRegisterMode ? (
              <button
                type="button"
                className="login-form__btn login-form__btn--secondary"
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setIsResetMode(true);
                }}
              >
                Забыли пароль?
              </button>
            ) : null}
            {isDesktop && !isResetMode ? (
              <button
                type="button"
                className="login-form__btn login-form__btn--secondary"
                onClick={() => {
                  enterDesktopOffline();
                }}
              >
                Работать офлайн
              </button>
            ) : null}
          </>
        )}
        {error ? <div className="login-error">{error}</div> : null}
        {message ? <div className="login-ok">{message}</div> : null}
      </form>
    </div>
  );
}
