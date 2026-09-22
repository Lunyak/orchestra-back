import { useEffect, useState } from "react";
import cn from "classnames";
import { Link } from "react-router-dom";
import {
  detectPreferredDesktopPlatform,
  fetchDesktopReleases,
  desktopReleaseFileUrl,
  formatReleaseSize,
  pickPreferredArtifact,
  type DesktopReleasesResponse,
} from "../model/desktop-releases";
import { ProductLandingDownloads } from "./ProductLandingDownloads";
import "./product-landing.css";

const FEATURES = [
  {
    title: "Сценарий",
    text: "Текст спектакля, сцены, реплики и пометки в одном месте.",
  },
  {
    title: "Техчасть",
    text: "Световая партитура и прогон: кадры, звук, смена состояний.",
  },
  {
    title: "3D сцена",
    text: "Площадка, свет и мизансцена до выхода на настоящую сцену.",
  },
  {
    title: "Репетиции",
    text: "Сессии, участники, задачи и команда вокруг одного проекта.",
  },
] as const;

const START_STEPS = [
  {
    title: "В вебе",
    text: "Создай аккаунт → новый проект → сценарий → свет → 3D сцена → репетиция.",
  },
  {
    title: "На компьютере",
    text: "Установи Orchestra, войди тем же аккаунтом и работай с проектом локально. Синхронизация — когда есть сеть.",
  },
] as const;

export function ProductLandingPage() {
  const [releases, setReleases] = useState<DesktopReleasesResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const preferredPlatform = detectPreferredDesktopPlatform();
  const latest = releases?.latest ?? null;
  const preferredArtifact = pickPreferredArtifact(latest, preferredPlatform);
  const hasPreferredDownload = Boolean(preferredArtifact && latest);
  const downloadHref = hasPreferredDownload && preferredArtifact && latest
    ? desktopReleaseFileUrl(latest.version, preferredArtifact.fileName)
    : "#desktop-downloads";
  const downloadLabel = preferredArtifact
    ? `Скачать для ${preferredArtifact.label}`
    : "Скачать десктоп";
  const downloadSize = preferredArtifact
    ? formatReleaseSize(preferredArtifact.size)
    : null;
  const downloadFileName = preferredArtifact?.fileName;

  useEffect(() => {
    let cancelled = false;
    fetchDesktopReleases()
      .then((data) => {
        if (cancelled) return;
        setReleases(data);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="product-landing">
      <header className="product-landing__hero">
        <p className="product-landing__eyebrow">Orchestra</p>
        <h1 className="product-landing__title">
          Спектакль от сценария до репетиции
        </h1>
        <p className="product-landing__lead">
          Инструмент режиссёра: текст, свет, площадка и план в одном проекте.
        </p>
        <div className="product-landing__actions">
          {hasPreferredDownload ? (
            <a
              className={cn("product-landing__btn", "product-landing__btn--primary")}
              href={downloadHref}
              download={downloadFileName}
            >
              {downloadLabel}
              {downloadSize ? (
                <span className="product-landing__artifact-size">{downloadSize}</span>
              ) : null}
            </a>
          ) : (
            <a
              className={cn("product-landing__btn", "product-landing__btn--primary")}
              href="#desktop-downloads"
            >
              {downloadLabel}
            </a>
          )}
          <Link
            className={cn("product-landing__btn", "product-landing__btn--ghost")}
            to="/login"
          >
            Войти
          </Link>
          <Link
            className={cn("product-landing__btn", "product-landing__btn--ghost")}
            to="/login?register=1"
          >
            Создать аккаунт
          </Link>
        </div>
      </header>

      <section className="product-landing__section" aria-labelledby="landing-features">
        <h2 id="landing-features" className="product-landing__section-title">
          Что внутри
        </h2>
        <ul className="product-landing__features">
          {FEATURES.map((item) => (
            <li key={item.title} className="product-landing__card">
              <h3 className="product-landing__card-title">{item.title}</h3>
              <p className="product-landing__card-text">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="product-landing__section" aria-labelledby="landing-start">
        <h2 id="landing-start" className="product-landing__section-title">
          Как начать
        </h2>
        <ul className="product-landing__start">
          {START_STEPS.map((item) => (
            <li key={item.title} className="product-landing__card">
              <h3 className="product-landing__card-title">{item.title}</h3>
              <p className="product-landing__card-text">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <ProductLandingDownloads
        releases={releases}
        loadError={loadError}
        preferredPlatform={preferredPlatform}
      />

      <footer className="product-landing__footer">
        <Link className="product-landing__legal" to="/privacy">
          Политика персональных данных
        </Link>
        <Link className="product-landing__legal" to="/terms">
          Пользовательское соглашение
        </Link>
      </footer>
    </div>
  );
}
