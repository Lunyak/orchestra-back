import { loginLayoutBackgroundStyle } from "@shared/assets/loginLayoutBackground";
import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "../../sync/api";
import { resetPassword } from "../../sync/auth";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(
    () => String(searchParams.get("token") ?? "").trim(),
    [searchParams],
  );

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const apiBase = getApiBaseUrl();
  const isLocal = apiBase.includes("localhost") || apiBase.includes("127.0.0.1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("В ссылке нет токена. Запросите новое письмо со страницы входа.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Пароль не короче 6 символов.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message;
      setError(typeof msg === "string" ? msg : "Не удалось сменить пароль");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div
        className="app-layout login-layout"
        style={loginLayoutBackgroundStyle}
      >
        <div className="login-form">
          <h1>Пароль обновлён</h1>
          <p className="login-form-subtitle">
            Теперь можно войти с новым паролем.
          </p>
          <p className="login-form-footer">
            <Link to="/">На страницу входа</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="app-layout login-layout"
      style={loginLayoutBackgroundStyle}
    >
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>Новый пароль</h1>
        <p className="login-form-subtitle">
          Вы перешли по ссылке из письма. Придумайте новый пароль для аккаунта.
        </p>
        <p className="login-api-hint" title={apiBase}>
          {isLocal ? "Подключение: локальный сервер" : "Подключение: сервер"}
          <span className="login-api-url"> {apiBase}</span>
        </p>
        {!token ? (
          <p className="login-error">
            Ссылка неполная или устарела. Запросите письмо ещё раз на странице
            входа.
          </p>
        ) : null}
        <label>
          Новый пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="минимум 6 символов"
            autoComplete="new-password"
            disabled={!token}
          />
        </label>
        <button type="submit" disabled={loading || !token}>
          {loading ? "…" : "Сохранить пароль"}
        </button>
        <p className="login-form-footer">
          <Link to="/">Назад к входу</Link>
        </p>
        {error ? <div className="login-error">{error}</div> : null}
      </form>
    </div>
  );
}
