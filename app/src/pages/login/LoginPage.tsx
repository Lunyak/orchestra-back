import { LoginForm } from "../../features/auth";

export function LoginPage({
  onAfterLogin,
}: {
  onAfterLogin?: (token: string) => Promise<void>;
}) {
  return <LoginForm onAfterLogin={onAfterLogin} />;
}
