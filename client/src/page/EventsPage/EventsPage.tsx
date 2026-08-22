import { FC, useEffect, useState } from "react";
import { ChalkPageShell } from "../../shared/component/ChalkPageShell/ChalkPageShell";
import { ChalkPlaybill } from "../../shared/component/ChalkPlaybill/ChalkPlaybill";
import { Seo } from "../../shared/component/Seo/Seo";
import type { SiteEvent } from "../../shared/model/siteContent";import { fetchSiteEvents, readSiteEventsCache } from "../../shared/model/siteContent";

const EventsPage: FC = () => {
  const [items, setItems] = useState<SiteEvent[]>(() => readSiteEventsCache() ?? []);
  const [eventsFetchSettled, setEventsFetchSettled] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSiteEvents()
      .then((remote) => {
        if (!alive) return;
        if (remote && remote.length) setItems(remote);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setEventsFetchSettled(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const isLoading = items.length === 0 && !eventsFetchSettled;

  return (
    <ChalkPageShell mainClassName="chalk-page__main--afisha" scrollable showHomeBack>
      <Seo
        title="Спектакли и афиша — Дофамин"
        description="Афиша театра «Дофамин»: спектакли, описание и ссылки на покупку билетов онлайн."
        canonicalPath="/события"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Афиша театра «Дофамин»",
          itemListElement: items
            .filter((e) => !e.soon)
            .map((e, idx) => ({
              "@type": "ListItem",
              position: idx + 1,
              name: e.name,
              url:
                typeof window !== "undefined"
                  ? `${window.location.origin}/события/${encodeURIComponent(e.slug)}`
                  : undefined,
            })),
        }}
      />

      <h1 className="chalk-page__title">АФИША</h1>
      <p className="chalk-page__subtitle">театр «Дофамин»</p>
      <div className="chalk-page__rule" aria-hidden />

      <ChalkPlaybill items={items} loading={isLoading} />
    </ChalkPageShell>
  );
};

export const Component = EventsPage;
