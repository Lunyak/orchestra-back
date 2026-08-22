import { Navigate, useParams } from "react-router-dom";
import {
  studioOrganizationPath,
  studioOverviewPath,
} from "../../app/router/paths";

export function StudioDetailPage() {
  const { studioId = "" } = useParams();
  if (!studioId) {
    return <Navigate to={studioOrganizationPath()} replace />;
  }
  return <Navigate to={studioOverviewPath(studioId)} replace />;
}
