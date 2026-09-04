import { AdminSectionChrome } from "@shared/components/admin/AdminSectionChrome";
import { TroupeAvailabilityView } from "../../troupe/ui/TroupeAvailabilityView";
import "../../../pages/troupe/style.css";
import "../../director-sessions/ui/director-sessions.css";

export function ProjectAvailabilityPage() {
  return (
    <div className="troupe-view troupe-view--availability">
      <AdminSectionChrome activeSection="team">
        <TroupeAvailabilityView />
      </AdminSectionChrome>
    </div>
  );
}
