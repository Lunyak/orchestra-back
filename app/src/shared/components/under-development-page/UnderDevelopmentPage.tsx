import { Button } from "@shared/core/button/Button";
import { useNavigate } from "react-router-dom";
import "./style.css";

interface UnderDevelopmentPageProps {
  title: string;
  description?: string;
}

export function UnderDevelopmentPage({ title, description }: UnderDevelopmentPageProps) {
  const navigate = useNavigate();

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="underdev-view">
            <h2>{title}</h2>
            <p className="underdev-text">
              Эта страница находится в стадии разработки и временно недоступна в production.
            </p>
            {description ? <p className="underdev-text">{description}</p> : null}
            <div className="underdev-actions">
              <Button className="secondary" type="button" onClick={() => navigate("/profile")}>
                Перейти в профиль
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
