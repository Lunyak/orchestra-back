import { useAuth } from "../../features/auth";
import { AdminSectionChrome } from "../../shared/components/admin/AdminSectionChrome";
import "../../features/rehearsals/ui/rehearsals.css";
import "../../features/director-sessions/ui/director-sessions.css";
import { PremisesIndexPanel } from "./PremisesIndexPanel";
import "./style.css";

export function PremisesPage() {
  const { accessToken } = useAuth();

  return (
    <div className="app-layout premises-layout">
      <div className="app-content">
        <main className="main-content main-content-premises">
          <div className="premises-view">
            <AdminSectionChrome activeSection="premises">
              <div className="premises-page__header">
                <div>
                  <h1 className="premises-page__title">Помещения</h1>
                  <p className="premises-page__lead">
                    Календарь аренды и субаренды залов и студий
                  </p>
                </div>
              </div>
              <div className="sessions-page rehearsals-page premises-page__body">
                <PremisesIndexPanel skip={!accessToken} />
              </div>
            </AdminSectionChrome>
          </div>
        </main>
      </div>
    </div>
  );
}
