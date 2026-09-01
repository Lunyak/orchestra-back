import { useNavigate } from "react-router-dom";
import { READY_TRAINERS } from "../../../features/trainers/trainerAvailability";

export function ProfileTrainersTab() {
  const navigate = useNavigate();

  return (
    <div className="profile-tab-page">
      <div className="profile-tab-main">
        <div className="profile-tab-head">
          <div className="profile-tab-title">Тренажёры</div>
        </div>

        <p className="profile-hint profile-tab-lead">
          Быстрые входы в упражнения. Сейчас доступен тренажёр по тексту роли.
        </p>

        <div className="profile-panel profile-trainers-panel">
          <div className="profile-trainer-cards">
            {READY_TRAINERS.map((item) => (
              <button
                key={item.path}
                type="button"
                className="profile-trainer-card"
                onClick={() => navigate(item.path)}
              >
                <div className="profile-trainer-card__header">
                  <h3 className="profile-trainer-card__title">{item.title}</h3>
                </div>
                <p className="profile-trainer-card__desc">{item.description}</p>
                <span className="profile-trainer-card__cta">Открыть</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
