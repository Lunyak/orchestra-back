import { useNavigate } from "react-router-dom";
import { READY_TRAINERS } from "../../features/trainers/trainerAvailability";
import "./style.css";

export function TrainersPage() {
  const navigate = useNavigate();

  return (
    <div className="app-layout trainers-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="trainers-view trainers-index">
            <header className="trainers-index__header">
              <h1 className="trainers-page-title">Тренажёры</h1>
              <p className="trainers-lead">
                Упражнения для ежедневной практики.
              </p>
            </header>

            <section className="trainers-panel trainers-index__panel">
              <div className="trainers-card-list">
                {READY_TRAINERS.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    className="trainer-index-card"
                    onClick={() => navigate(item.path)}
                  >
                    <div className="trainer-index-card__header">
                      <h2 className="trainer-index-card__title">{item.title}</h2>
                    </div>
                    <p className="trainer-index-card__desc">{item.description}</p>
                    <span className="trainer-index-card__cta">Открыть</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
