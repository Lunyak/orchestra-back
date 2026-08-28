import "../../features/auth/ui/login.css";
import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "../../sync/api/client";
import { resetPassword } from "../../sync/auth";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get("token") ?? "").trim();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const apiBase = getApiBaseUrl();
  const isDesktop = import.meta.env.MODE === "desktop";
  const isLocal = apiBase.includes("localhost") || apiBase.includes("127.0.0.1");
  const hasToken = Boolean(token);

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
      <div className="app-layout login-layout">
        <div className="login-form">
          <h1 className="login-form__title">Пароль обновлён</h1>
          <p className="login-form-subtitle">
            Теперь можно войти с новым паролем.
          </p>
          <div className="login-ok">Готово. Ссылка из письма больше не нужна.</div>
          <p className="login-form-footer">
            <Link className="login-form__link" to="/">
              На страницу входа
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout login-layout">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-form__title">Новый пароль</h1>
        <p className="login-form-subtitle">
          Вы перешли по ссылке из письма. Придумайте новый пароль для аккаунта.
        </p>
        {isDesktop ? (
          <p className="login-api-hint" title={apiBase}>
            {isLocal ? "Подключение: локальный сервер" : "Подключение: сервер"}
            <span className="login-api-url">{apiBase}</span>
          </p>
        ) : null}
        {!hasToken ? (
          <div className="login-error">
            Ссылка неполная или устарела. Запросите письмо ещё раз на странице
            входа.
          </div>
        ) : null}
        <label className="login-form__label">
          Новый пароль
          <input
            className="login-form__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="минимум 6 символов"
            autoComplete="new-password"
            disabled={!hasToken}
            required={hasToken}
            minLength={6}
          />
        </label>
        <button
          type="submit"
          className="login-form__btn login-form__btn--submit"
          disabled={loading || !hasToken}
        >
          {loading ? "…" : "Сохранить пароль"}
        </button>
        <p className="login-form-footer">
          <Link className="login-form__link" to="/">
            Назад к входу
          </Link>
        </p>
        {error ? <div className="login-error">{error}</div> : null}
      </form>
    </div>
  );
}
