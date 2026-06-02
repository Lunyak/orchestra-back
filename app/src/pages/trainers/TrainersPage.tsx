import { useNavigate } from "react-router-dom";
import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import { isTrainerInDevelopment } from "../../features/trainers/trainerAvailability";
import "./style.css";

const TRAINERS = [
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
  {
    title: "Учить текст роли",
    description: "Тренажёр по репликам выбранной роли (диалог, карточки, голос).",
    path: "/actor",
    variant: "secondary" as const,
  },
] as const;

export function TrainersPage() {
  const navigate = useNavigate();

  return (
    <div className="app-layout trainers-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="trainers-view">
            <h1 className="trainers-page-title">Тренажёры</h1>

            <p className="trainers-lead">
              Короткие упражнения для ежедневной практики. «Речь» и «Дикция» пока в разработке.
            </p>

            <div className="trainers-card-list">
              {TRAINERS.map((item) => {
                const inDev = isTrainerInDevelopment(item.path);
                const buttonVariant = "variant" in item ? item.variant : "primary";

                return (
                  <article
                    key={item.path}
                    className={cn("trainer-card", inDev && "trainer-card--disabled")}
                  >
                    <div className="trainer-card__head">
                      <h2 className="trainer-card-title">{item.title}</h2>
                      {inDev ? <span className="trainer-card__badge">В разработке</span> : null}
                    </div>
                    <p className="trainer-card-text">{item.description}</p>
                    <div className="trainer-card__actions">
                      <Button
                        type="button"
                        variant={buttonVariant}
                        disabled={inDev}
                        onClick={() => {
                          if (inDev) return;
                          navigate(item.path);
                        }}
                      >
                        {inDev ? "Скоро" : "Открыть"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="trainers-toolbar">
              <Button variant="secondary" type="button" onClick={() => navigate("/profile")}>
                Профиль
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
