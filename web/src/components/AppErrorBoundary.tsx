import React from "react";

interface AppErrorBoundaryState {
  error: Error | null;
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
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Keep full details in console for production debugging.
    console.error("[web] Unhandled render error", error, errorInfo);
  }

  private handleGlobalError = (event: ErrorEvent) => {
    const nextError =
      event.error instanceof Error
        ? event.error
        : new Error(event.message || "Unhandled window error");
    this.setState({ error: nextError });
    console.error("[web] Global window error", nextError, event);
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
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

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#0f1115",
          color: "#f3f5f7",
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 640,
            width: "100%",
            background: "#e78a4e",
            padding: 20,
            boxSizing: "border-box",
          }}
        >
          <h1 style={{ margin: "0 0 8px 0", fontSize: 22 }}>Приложение упало</h1>
          <p style={{ margin: "0 0 10px 0", opacity: 0.92 }}>
            {maybeChunkLoad
              ? "Похоже, не удалось загрузить часть веб-приложения после обновления."
              : "Произошла непредвиденная ошибка во время рендера."}
          </p>
          <pre
            style={{
              margin: "0 0 14px 0",
              padding: 12,
              overflowX: "auto",
              background: "#0f1115",
              border: "1px solid #2a303d",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {`${error.name}: ${message}`}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #3a4252",
              background: "#2d6cdf",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }
}
