import cn from "classnames";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import {
  desktopReleaseFileUrl,
  formatReleaseDate,
  formatReleaseSize,
  type DesktopRelease,
  type DesktopReleasePlatform,
  type DesktopReleasesResponse,
} from "../model/desktop-releases";

type ProductLandingDownloadsProps = {
  releases: DesktopReleasesResponse | null;
  loadError: boolean;
  preferredPlatform: DesktopReleasePlatform | null;
};

export function ProductLandingDownloads({
  releases,
  loadError,
  preferredPlatform,
}: ProductLandingDownloadsProps) {
  const isLoading = releases === null && !loadError;
  const items = releases?.releases ?? [];
  const latestVersion = releases?.latest?.version ?? null;

  return (
    <section
      className="product-landing__section"
      aria-labelledby="landing-downloads"
      id="desktop-downloads"
    >
      <h2 id="landing-downloads" className="product-landing__section-title">
        Десктоп
      </h2>
      <p className="product-landing__section-lead">
        Установите Orchestra на компьютер: проект доступен офлайн, синхронизация
        — когда есть сеть. Ниже все опубликованные версии.
      </p>
      {isLoading ? (
        <PageLoader variant="view" label="Загрузка сборок…" />
      ) : null}
      {loadError ? (
        <p className="product-landing__hint">
          Не удалось загрузить список сборок. Обновите страницу.
        </p>
      ) : null}
      {!isLoading && !loadError && items.length === 0 ? (
        <p className="product-landing__hint">Сборки пока не опубликованы.</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="product-landing__releases">
          {items.map((release) => (
            <ReleaseCard
              key={release.version}
              release={release}
              isLatest={release.version === latestVersion}
              preferredPlatform={preferredPlatform}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ReleaseCard({
  release,
  isLatest,
  preferredPlatform,
}: {
  release: DesktopRelease;
  isLatest: boolean;
  preferredPlatform: DesktopReleasePlatform | null;
}) {
  const published = formatReleaseDate(release.publishedAt);

  return (
    <li
      className={cn(
        "product-landing__release",
        isLatest && "product-landing__release--latest",
      )}
    >
      <div className="product-landing__release-head">
        <h3 className="product-landing__card-title">{release.version}</h3>
        {isLatest ? (
          <span className="product-landing__release-badge">Актуальная</span>
        ) : null}
        {published ? (
          <span className="product-landing__release-date">{published}</span>
        ) : null}
      </div>
      <ul className="product-landing__artifacts">
        {release.artifacts.map((artifact) => {
          const href = desktopReleaseFileUrl(release.version, artifact.fileName);
          const isPreferred = artifact.platform === preferredPlatform;
          return (
            <li key={artifact.fileName}>
              <a
                className={cn(
                  "product-landing__btn",
                  isPreferred
                    ? "product-landing__btn--primary"
                    : "product-landing__btn--ghost",
                )}
                href={href}
                download={artifact.fileName}
              >
                {artifact.label}
                <span className="product-landing__artifact-size">
                  {formatReleaseSize(artifact.size)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
