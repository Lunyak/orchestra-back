import { useNavigate } from "react-router-dom";
import { isTrainerInDevelopment } from "../../../features/trainers/trainerAvailability";

const TRAINERS = [
  {
    title: "Учить текст роли",
    description: "Тренажёр по репликам выбранной роли (диалог, карточки, голос).",
    path: "/actor",
  },
  {
    title: "Речь",
    description: "Дыхание + чтение с темпом (метроном).",
    path: "/trainers/speech",
  },
  {
    title: "Дикция",
    description: "Скороговорки + история попыток.",
    path: "/trainers/diction",
  },
] as const;

export function ProfileTrainersTab() {
  const navigate = useNavigate();

  return (
    <div className="profile-tab-page">
      <div className="profile-tab-main">
        <div className="profile-tab-head">
          <div className="profile-tab-title">Тренажёры</div>
        </div>

        <p className="profile-hint profile-tab-lead">
          Быстрые входы в упражнения. «Речь» и «Дикция» пока в разработке — доступен тренажёр по тексту роли.
        </p>

        <div className="profile-panel profile-trainers-panel">
          <div className="profile-trainer-cards">
            {TRAINERS.map((item) => {
              const inDev = isTrainerInDevelopment(item.path);
              return (
                <button
                  key={item.path}
                  type="button"
                  className={inDev ? "profile-trainer-card profile-trainer-card--disabled" : "profile-trainer-card"}
                  disabled={inDev}
                  onClick={() => {
                    if (inDev) return;
                    navigate(item.path);
                  }}
                >
                  <div className="profile-trainer-card__head">
                    <h3 className="profile-trainer-card__title">{item.title}</h3>
                    {inDev ? <span className="profile-trainer-card__badge">В разработке</span> : null}
                  </div>
                  <p className="profile-trainer-card__desc">{item.description}</p>
                  <span className="profile-trainer-card__cta">{inDev ? "Скоро" : "Открыть"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
