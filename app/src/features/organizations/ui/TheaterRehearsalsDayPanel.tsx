import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import type { TheaterRehearsal } from "../../../sync/api/workspaces";
import type { DirectorRehearsalSession } from "../../director-sessions";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import { TheaterRehearsalsCallFooter } from "./TheaterRehearsalsCallFooter";
import { TheaterRehearsalsDayItem } from "./TheaterRehearsalsDayItem";

type TheaterRehearsalsDayPanelProps = {
  selectedDateLabel: string;
  dayMetaLabel: string;
  canCreateRehearsal: boolean;
  onCreate: () => void;
  loading: boolean;
  dayRehearsals: TheaterRehearsal[];
  bundleSessions: DirectorRehearsalSession[];
  selectedRehearsalId: string | null;
  onSelectRehearsal: (rehearsalId: string) => void;
  onOpenRehearsal: (rehearsalId: string) => void;
  selectedRehearsal: TheaterRehearsal | null;
  selectedCanManage: boolean;
  selectedCanPublish: boolean;
  selectedPublished: boolean;
  publishError: string;
  creating: boolean;
  publishing: boolean;
  includeUnavailableInCall: boolean;
  onIncludeUnavailableChange: (value: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPublish: () => void;
};

export function TheaterRehearsalsDayPanel({
  selectedDateLabel,
  dayMetaLabel,
  canCreateRehearsal,
  onCreate,
  loading,
  dayRehearsals,
  bundleSessions,
  selectedRehearsalId,
  onSelectRehearsal,
  onOpenRehearsal,
  selectedRehearsal,
  selectedCanManage,
  selectedCanPublish,
  selectedPublished,
  publishError,
  creating,
  publishing,
  includeUnavailableInCall,
  onIncludeUnavailableChange,
  onEdit,
  onDelete,
  onPublish,
}: TheaterRehearsalsDayPanelProps) {
  const createTitle = `Создать репетицию на ${selectedDateLabel}`;
  const showEmptyDay = !loading && dayRehearsals.length === 0;

  return (
    <RehearsalsCard fluid className="sessions-day-stage">
      <div className="sessions-nav-head">
        <span className="sessions-nav-head__title">{selectedDateLabel}</span>
        <span className="sessions-nav-head__meta rehearsals-muted">
          {dayMetaLabel}
        </span>
      </div>

      {canCreateRehearsal ? (
        <div className="sessions-day-toolbar">
          <Button type="button" title={createTitle} onClick={onCreate}>
            Создать репетицию
          </Button>
        </div>
      ) : null}

      {loading ? (
        <PageLoader variant="view" label="Загрузка репетиций…" />
      ) : null}

      <div className="sessions-day-list">
        {showEmptyDay ? (
          <div className="rehearsals-muted sessions-day-list__empty">
            На этот день репетиций нет. Создайте репетицию и заполните слоты.
          </div>
        ) : null}

        {dayRehearsals.map((rehearsal) => (
          <TheaterRehearsalsDayItem
            key={`${rehearsal.source}:${rehearsal.id}`}
            rehearsal={rehearsal}
            bundleSessions={bundleSessions}
            isSelected={rehearsal.id === selectedRehearsalId}
            onSelect={() => onSelectRehearsal(rehearsal.id)}
            onOpen={() => onOpenRehearsal(rehearsal.id)}
          />
        ))}
      </div>

      {selectedRehearsal ? (
        <TheaterRehearsalsCallFooter
          publishError={publishError}
          selectedCanManage={selectedCanManage}
          selectedCanPublish={selectedCanPublish}
          selectedPublished={selectedPublished}
          creating={creating}
          publishing={publishing}
          includeUnavailableInCall={includeUnavailableInCall}
          onIncludeUnavailableChange={onIncludeUnavailableChange}
          onEdit={onEdit}
          onDelete={onDelete}
          onPublish={onPublish}
          onOpen={() => onOpenRehearsal(selectedRehearsal.id)}
        />
      ) : null}
    </RehearsalsCard>
  );
}
