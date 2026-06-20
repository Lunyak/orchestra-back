import { useNavigate } from "react-router-dom";
import cn from "classnames";
import { isTrainerInDevelopment } from "../../features/trainers/trainerAvailability";
import "./style.css";

const TRAINERS = [
  {
    title: "Учить текст роли",
    description: "Тренажёр по репликам выбранной роли (диалог, карточки, голос).",
    path: "/actor",
  },
  {
    title: "Речь",
    description: "Дыхание + чтение с темпом (метроном). Помогает держать опору и ровную подачу.",
    path: "/trainers/speech",
  },
  {
    title: "Дикция",
    description: "Скороговорки + замеры попыток. Можно фиксировать длительность и заметки.",
    path: "/trainers/diction",
  },
] as const;

export function TrainersPage() {
  const navigate = useNavigate();

  return (
    <div className="app-layout trainers-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="trainers-view trainers-index">
            <header className="trainers-index__head">
              <h1 className="trainers-page-title">Тренажёры</h1>
              <p className="trainers-lead">
                Короткие упражнения для ежедневной практики. «Речь» и «Дикция» пока в разработке.
              </p>
            </header>

            <section className="trainers-panel trainers-index__panel">
              <div className="trainers-card-list">
                {TRAINERS.map((item) => {
                  const inDev = isTrainerInDevelopment(item.path);
                  const cardClassName = cn(
                    "trainer-index-card",
                    inDev && "trainer-index-card--disabled",
                  );

                  return (
                    <button
                      key={item.path}
                      type="button"
                      className={cardClassName}
                      disabled={inDev}
                      onClick={() => {
                        if (inDev) return;
                        navigate(item.path);
                      }}
                    >
                      <div className="trainer-index-card__head">
                        <h2 className="trainer-index-card__title">{item.title}</h2>
                        {inDev ? (
                          <span className="trainer-index-card__badge">В разработке</span>
                        ) : null}
                      </div>
                      <p className="trainer-index-card__desc">{item.description}</p>
                      <span className="trainer-index-card__cta">
                        {inDev ? "Скоро" : "Открыть"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
