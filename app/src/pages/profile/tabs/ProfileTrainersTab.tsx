import { useNavigate } from "react-router-dom";
import { Button } from "@shared/core/button/Button";

export function ProfileTrainersTab() {
  const navigate = useNavigate();

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 8, maxWidth: 720 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Тренажёры</div>
      <div style={{ fontSize: 12, opacity: 0.75, lineHeight: "16px" }}>
        Это быстрые входы в упражнения. Список можно расширять: речь, дикция, дыхание, паузы и т.д.
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>Учить текст роли</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            Уже реализовано: тренажёр по репликам выбранной роли (диалог/карточки/голос).
          </div>
          <div style={{ marginTop: 8 }}>
            <Button className="primary" type="button" onClick={() => navigate("/actor")}>
              Открыть
            </Button>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>Речь</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            Дыхание + чтение с темпом (метроном).
          </div>
          <div style={{ marginTop: 8 }}>
            <Button className="primary" type="button" onClick={() => navigate("/trainers/speech")}>
              Открыть
            </Button>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>Дикция</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            Скороговорки + история попыток.
          </div>
          <div style={{ marginTop: 8 }}>
            <Button className="primary" type="button" onClick={() => navigate("/trainers/diction")}>
              Открыть
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

