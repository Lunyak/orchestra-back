import "./login.css";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import { loginLayoutBackgroundStyle } from "@shared/assets/loginLayoutBackground";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseUrl } from "../../../sync/api/client";
import { forgotPassword } from "../../../sync/auth";
import { useAuth } from "../model/auth-context";

export function LoginForm({
  onAfterLogin,
}: {
  onAfterLogin?: (token: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const { login: doLogin, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const apiBase = getApiBaseUrl();
  const isLocal =
    apiBase.includes("localhost") || apiBase.includes("127.0.0.1");

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
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message;
      setError(typeof msg === "string" ? msg : "Ошибка");
    }
  };

  return (
    <div
      className="app-layout login-layout"
      style={loginLayoutBackgroundStyle}
    >
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>
          {isResetMode
            ? "Сброс пароля"
            : isRegisterMode
              ? "Регистрация"
              : "Вход"}
        </h1>
        <p className="login-form-subtitle">
          Войди в аккаунт, чтобы работать с проектами и сценарием на этом
          устройстве.
        </p>

        <label className="login-form__label">
          Email
          <input
            className="login-form__input "
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {isResetMode ? (
          <>
            <p className="login-form-subtitle" style={{ marginTop: 8 }}>
              Мы отправим письмо со ссылкой для смены пароля (если такой аккаунт
              есть).
            </p>
            <div>
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
                    const msg =
                      err &&
                      typeof err === "object" &&
                      "response" in err &&
                      (err as { response?: { data?: { message?: string } } })
                        .response?.data?.message;
                    setError(typeof msg === "string" ? msg : "Ошибка");
                  } finally {
                    setResetLoading(false);
                  }
                }}
              >
                {resetLoading ? "…" : "Отправить ссылку"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setError(null);
                  setMessage(null);
                }}
              >
                Назад к входу
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="login-form__label">
              Пароль
              <input
                className="login-form__input "
                type="password"
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
                  <a href="/terms" target="_blank" rel="noreferrer">
                    Пользовательское соглашение
                  </a>{" "}
                  и ознакомлен(а) с{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer">
                    Политикой обработки персональных данных
                  </a>
                  .
                </span>
              </LabeledCheckbox>
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
              {isRegisterMode
                ? "У меня уже есть аккаунт"
                : "Создать новый аккаунт"}
            </button>
            {!isRegisterMode ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setIsResetMode(true);
                }}
              >
                Забыли пароль?
              </button>
            ) : null}
          </>
        )}
        {error && <div className="login-error">{error}</div>}
        {message && <div className="login-form-footer">{message}</div>}
      </form>
    </div>
  );
}
