import { Link } from "react-router-dom";
import { getAppHubDestinations } from "../model/app-hub-destinations";
import "./app-hub.css";

export function AppHubPage() {
  const destinations = getAppHubDestinations();

  return (
    <div className="app-layout app-hub-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="app-hub">
            <ul className="app-hub__grid">
              {destinations.map((destination) => (
                <li key={destination.id}>
                  <Link to={destination.path} className="app-hub__tile">
                    <img
                      src={destination.imageSrc}
                      alt={destination.imageAlt}
                      className="app-hub__tile-image"
                    />
                    <span className="app-hub__tile-body">
                      <span className="app-hub__tile-label">
                        {destination.label}
                      </span>
                      <span className="app-hub__tile-desc">
                        {destination.description}
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
