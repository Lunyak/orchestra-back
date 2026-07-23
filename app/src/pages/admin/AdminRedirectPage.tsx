import { Navigate } from "react-router-dom";
import { resolveAdminEntryPath } from "../../shared/settings/adminSection";

export function AdminRedirectPage() {
  return <Navigate to={resolveAdminEntryPath()} replace />;
}
