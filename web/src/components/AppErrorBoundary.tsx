import React from "react";
import "./app-error-boundary.css";

interface AppErrorBoundaryState {
  error: Error | null;
}

/** Браузерный шум от ResizeObserver; не ломает UI, но Chrome шлёт его как window error. */
function isBenignResizeObserverError(error: unknown, message?: string): boolean {
  const text = [
    error instanceof Error ? error.message : "",
    error instanceof Error ? error.name : "",
    typeof message === "string" ? message : "",
    typeof error === "string" ? error : "",
  ]
    .join(" ")
    .toLowerCase();
  return /resizeobserver loop/.test(text);
}

/** Сетевые/API сбои не должны валить всё приложение (рестарт бэка, 5xx, offline). */
function isBenignNetworkRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  const code =
    "code" in error && error.code != null ? String(error.code) : "";
  if (name === "AxiosError") return true;
  if (/^ERR_NETWORK$|^ECONNABORTED$|^ERR_CANCELED$|^ECONNREFUSED$/i.test(code)) {
    return true;
  }
  return /request failed with status code|network error|failed to fetch/i.test(
    message,
  );
}

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  componentDidMount() {
    if (typeof window === "undefined") return;
    window.addEventListener("error", this.handleGlobalError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    if (typeof window === "undefined") return;
    window.removeEventListener("error", this.handleGlobalError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    if (isBenignResizeObserverError(error)) {
      return { error: null };
    }
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[web] Unhandled render error", error, errorInfo);
  }

  private handleGlobalError = (event: ErrorEvent) => {
    if (isBenignResizeObserverError(event.error, event.message)) {
      event.preventDefault();
      return;
    }
    const nextError =
      event.error instanceof Error
        ? event.error
        : new Error(event.message || "Unhandled window error");
    this.setState({ error: nextError });
    console.error("[web] Global window error", nextError, event);
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    if (isBenignResizeObserverError(reason)) {
      event.preventDefault();
      return;
    }
    if (isBenignNetworkRejection(reason)) {
      event.preventDefault();
      console.warn("[web] Ignored network rejection", reason);
      return;
    }
    const nextError =
      reason instanceof Error
        ? reason
        : new Error(
            typeof reason === "string"
              ? reason
              : "Unhandled promise rejection",
          );
    this.setState({ error: nextError });
    console.error("[web] Unhandled promise rejection", reason);
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const message =
      error.message?.trim() || "Неизвестная ошибка при отрисовке приложения";
    const maybeChunkLoad =
      /chunk|import|loading|fetch/i.test(message) ||
      /chunk|import|loading|fetch/i.test(error.name);
    const lead = maybeChunkLoad
      ? "Похоже, не удалось загрузить часть веб-приложения после обновления."
      : "Произошла непредвиденная ошибка во время рендера.";
    const details = `${error.name}: ${message}`;

    return (
      <div className="app-error-boundary" role="alert">
        <div className="app-error-boundary__card">
          <p className="app-error-boundary__eyebrow">Orchestra</p>
          <h1 className="app-error-boundary__title">Приложение упало</h1>
          <p className="app-error-boundary__lead">{lead}</p>
          <pre className="app-error-boundary__details">{details}</pre>
          <div className="app-error-boundary__actions">
            <button
              type="button"
              className="app-error-boundary__reload"
              onClick={this.handleReload}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      </div>
    );
  }
}
