import { Navigate } from "react-router-dom";
import { studioOrganizationPath } from "../../app/router/paths";

export function StudiosPage() {
  return <Navigate to={studioOrganizationPath()} replace />;
}
