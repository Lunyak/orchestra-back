import React, { useState } from "react";
import { getApiBaseUrl } from "../../../sync/api";
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
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [acceptLegal, setAcceptLegal] = useState(false);

  const apiBase = getApiBaseUrl();
  const isLocal = apiBase.includes("localhost") || apiBase.includes("127.0.0.1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegisterMode) {
        if (!acceptLegal) {
          setError("Нужно принять соглашение и политику, чтобы создать аккаунт");
          return;
        }
        try {
          localStorage.setItem("legalAcceptedAt", new Date().toISOString());
          localStorage.setItem("legalAcceptedVersion", "1.0");
        } catch {}
        await signUp(email.trim(), password, onAfterLogin);
      } else {
        await doLogin(email.trim(), password, onAfterLogin);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Ошибка");
    }
  };

  return (
    <div className="app-layout login-layout">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>{isRegisterMode ? "Регистрация" : "Вход"}</h1>
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
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={isRegisterMode && !acceptLegal}>
          {isRegisterMode ? "Создать аккаунт" : "Войти"}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAcceptLegal(false);
            setIsRegisterMode((prev) => !prev);
          }}
        >
          {isRegisterMode ? "У меня уже есть аккаунт" : "Создать новый аккаунт"}
        </button>
        <p className="login-form-footer">
          Сервер API: <code>{apiBase}</code>
        </p>
      </form>
    </div>
  );
}
