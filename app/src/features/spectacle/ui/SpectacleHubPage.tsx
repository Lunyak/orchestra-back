import { Link } from "react-router-dom";
import { useProject } from "../../project";
import { getSpectacleHubDirections } from "../model/spectacle-hub-directions";
import "./spectacle-hub.css";

export function SpectacleHubPage() {
  const { projectName } = useProject();
  const directions = getSpectacleHubDirections(projectName);

  return (
    <div className="app-layout spectacle-hub-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="spectacle-hub">
            <ul className="spectacle-hub__grid">
              {directions.map((direction) => (
                <li key={direction.id}>
                  <Link
                    to={direction.path}
                    className="spectacle-hub__tile"
                  >
                    <img
                      src={direction.imageSrc}
                      alt={direction.imageAlt}
                      className="spectacle-hub__tile-image"
                    />
                    <span className="spectacle-hub__tile-body">
                      <span className="spectacle-hub__tile-label">
                        {direction.label}
                      </span>
                      <span className="spectacle-hub__tile-desc">
                        {direction.description}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
