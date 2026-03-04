import React, { useState } from "react";
import { getApiBaseUrl } from "../../../sync/api";
import { forgotPassword, resetPassword } from "../../../sync/auth";
import { useAuth } from "../model/auth-context";

export function LoginForm({
  onAfterLogin,
}: {
  onAfterLogin?: (token: string) => Promise<void>;
}) {
  const { login: doLogin, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const apiBase = getApiBaseUrl();
  const isLocal = apiBase.includes("localhost") || apiBase.includes("127.0.0.1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const emailNorm = email.trim().toLowerCase();
      if (isResetMode) {
        if (!resetToken.trim()) {
          setError("Нужен код/токен для сброса");
          return;
        }
        if (!resetNewPassword) {
          setError("Нужен новый пароль");
          return;
        }
        setResetLoading(true);
        await resetPassword(resetToken.trim(), resetNewPassword);
        setResetLoading(false);
        setIsResetMode(false);
        setResetToken("");
        setResetNewPassword("");
        setPassword("");
        setMessage("Пароль обновлён. Теперь войдите с новым паролем.");
        return;
      }
      if (isRegisterMode) {
        if (!acceptLegal) {
          setError("Нужно принять соглашение и политику, чтобы создать аккаунт");
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
    } catch (err: any) {
      setResetLoading(false);
      setError(err?.response?.data?.message ?? "Ошибка");
    }
  };

  return (
    <div className="app-layout login-layout">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>
          {isResetMode ? "Сброс пароля" : isRegisterMode ? "Регистрация" : "Вход"}
        </h1>
        <p className="login-form-subtitle">
          Войди в аккаунт, чтобы работать с проектами и сценарием на этом устройстве.
        </p>
        <p className="login-api-hint" title={apiBase}>
          {isLocal ? "Подключение: локальный сервер" : "Подключение: сервер"}
          <span className="login-api-url"> {apiBase}</span>
        </p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {isResetMode ? (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <button
                type="button"
                disabled={!email.trim() || resetLoading}
                onClick={async () => {
                  setError(null);
                  setMessage(null);
                  const emailNorm = email.trim().toLowerCase();
                  if (!emailNorm) return;
                  setResetLoading(true);
                  try {
                    const res = await forgotPassword(emailNorm);
                    // В проде токен не возвращаем (его надо доставлять пользователю по каналу связи).
                    if (res?.token) setResetToken(res.token);
                    setMessage(
                      res?.token
                        ? "Код создан (dev): вставлен в поле ниже."
                        : "Если такой email существует, мы подготовили сброс пароля.",
                    );
                  } catch (err: any) {
                    setError(err?.response?.data?.message ?? "Ошибка");
                  } finally {
                    setResetLoading(false);
                  }
                }}
              >
                {resetLoading ? "…" : "Получить код"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setError(null);
                  setMessage(null);
                  setResetToken("");
                  setResetNewPassword("");
                }}
              >
                Назад к входу
              </button>
            </div>
            <label>
              Код / токен
              <input
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="вставь код из письма/сообщения"
              />
            </label>
            <label>
              Новый пароль
              <input
                type="password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="минимум 6 символов"
              />
            </label>
            <button type="submit" disabled={resetLoading}>
              {resetLoading ? "…" : "Сменить пароль"}
            </button>
          </>
        ) : (
          <>
            <label>
              Пароль
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {isRegisterMode ? (
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={acceptLegal}
                  onChange={(e) => setAcceptLegal(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span style={{ fontSize: 13, opacity: 0.9, lineHeight: "18px" }}>
                  Я принимаю{" "}
                  <a href="/terms" target="_blank" rel="noreferrer">
                    Пользовательское соглашение
                  </a>{" "}
                  и ознакомлен(а) с{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer">
                    Политикой обработки персональных данных
                  </a>
                  .
                </span>
              </label>
            ) : null}
            <button type="submit" disabled={isRegisterMode && !acceptLegal}>
              {isRegisterMode ? "Создать аккаунт" : "Войти"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMessage(null);
                setAcceptLegal(false);
                setIsRegisterMode((prev) => !prev);
              }}
            >
              {isRegisterMode ? "У меня уже есть аккаунт" : "Создать новый аккаунт"}
            </button>
            {!isRegisterMode ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setIsResetMode(true);
                  setResetToken("");
                  setResetNewPassword("");
                }}
              >
                Забыли пароль?
              </button>
            ) : null}
          </>
        )}
        {error && <div className="login-error">{error}</div>}
        {message && <div className="login-form-footer">{message}</div>}
        <p className="login-form-footer">
          Сервер API: <code>{apiBase}</code>
        </p>
      </form>
    </div>
  );
}
