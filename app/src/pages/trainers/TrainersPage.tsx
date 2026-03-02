import { useNavigate } from "react-router-dom";
import { Button } from "@shared/core/button/Button";
import "./style.css";

export function TrainersPage() {
  const navigate = useNavigate();

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="trainers-view">
            <h2>Тренажёры</h2>
            <p className="trainers-subtitle">Короткие упражнения для ежедневной практики.</p>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div className="trainer-card">
                <div className="trainer-card-title">Речь</div>
                <div className="trainer-card-text">
                  Дыхание + чтение с темпом (метроном). Помогает держать опору и ровную подачу.
                </div>
                <div style={{ marginTop: 10 }}>
                  <Button className="primary" type="button" onClick={() => navigate("/trainers/speech")}>
                    Открыть
                  </Button>
                </div>
              </div>

              <div className="trainer-card">
                <div className="trainer-card-title">Дикция</div>
                <div className="trainer-card-text">
                  Скороговорки + замеры попыток. Можно фиксировать длительность и заметки.
                </div>
                <div style={{ marginTop: 10 }}>
                  <Button className="primary" type="button" onClick={() => navigate("/trainers/diction")}>
                    Открыть
                  </Button>
                </div>
              </div>

              <div className="trainer-card">
                <div className="trainer-card-title">Учить текст роли</div>
                <div className="trainer-card-text">
                  Тренажёр по репликам выбранной роли (диалог/карточки/голос) — уже реализован.
                </div>
                <div style={{ marginTop: 10 }}>
                  <Button className="secondary" type="button" onClick={() => navigate("/actor")}>
                    Открыть
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

