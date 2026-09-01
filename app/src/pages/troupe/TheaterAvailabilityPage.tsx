import { Navigate, useParams } from "react-router-dom";
import { theaterOrganizationPath } from "../../app/router/paths";
import { TheaterSectionNav } from "../../features/organizations/ui/TheaterSectionNav";
import { TroupeAvailabilityView } from "../../features/troupe/ui/TroupeAvailabilityView";
import { AdminSectionChrome } from "../../shared/components/admin/AdminSectionChrome";
import "../../features/organizations/ui/organizations.css";
import "./style.css";

export function TheaterAvailabilityPage() {
  const { theaterId = "" } = useParams();

  if (!theaterId) {
    return <Navigate to={theaterOrganizationPath()} replace />;
  }

  return (
    <div className="app-layout troupe-layout">
      <div className="app-content">
        <TheaterSectionNav theaterId={theaterId} active="availability" />
        <main className="main-content">
          <div className="troupe-view troupe-view--availability">
            <AdminSectionChrome activeSection="team">
              <TroupeAvailabilityView />
            </AdminSectionChrome>
          </div>
        </main>
      </div>
    </div>
  );
}

export default TheaterAvailabilityPage;
