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

  const apiBase = getApiBaseUrl();
  const isLocal = apiBase.includes("localhost") || apiBase.includes("127.0.0.1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegisterMode) {
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
        {error && <div className="login-error">{error}</div>}
        <button type="submit">
          {isRegisterMode ? "Создать аккаунт" : "Войти"}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
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
