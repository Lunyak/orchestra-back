import { Component, Suspense, type ReactNode } from "react";

type GltfGuardProps = {
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: string;
};

type GltfLoadErrorBoundaryState = {
  hasError: boolean;
};

class GltfLoadErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  GltfLoadErrorBoundaryState
> {
  state: GltfLoadErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GltfLoadErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function GltfGuard({
  children,
  fallback = null,
  resetKey,
}: GltfGuardProps) {
  return (
    <GltfLoadErrorBoundary key={resetKey} fallback={fallback}>
      <Suspense fallback={null}>{children}</Suspense>
    </GltfLoadErrorBoundary>
  );
}
