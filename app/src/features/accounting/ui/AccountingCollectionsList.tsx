import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { accountingPath } from "../../../app/router/paths";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import type { CollectionSummary } from "../../../sync/api/accounting";
import {
  collectionOwnerLabel,
  collectionStatusLabel,
} from "../../../sync/api/accounting";
import { collectionProgressPercent, formatRub } from "../model/format-rub";

type AccountingCollectionsListProps = {
  isLoading: boolean;
  collections: CollectionSummary[];
  canCreate: boolean;
  hasResolvedTab: boolean;
  onCreateFirst: () => void;
};

export function AccountingCollectionsList({
  isLoading,
  collections,
  canCreate,
  hasResolvedTab,
  onCreateFirst,
}: AccountingCollectionsListProps) {
  const showCreateFirst = canCreate && hasResolvedTab;

  return (
    <RehearsalsCard fluid>
      {isLoading ? (
        <PageLoader variant="view" label="Загрузка…" />
      ) : collections.length === 0 ? (
        <div className="accounting-empty">
          <p>Сборов пока нет.</p>
          {showCreateFirst ? (
            <Button type="button" onClick={onCreateFirst}>
              Создать первый сбор
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="accounting-list">
          {collections.map((collection) => (
            <AccountingCollectionRow
              key={collection.id}
              collection={collection}
            />
          ))}
        </ul>
      )}
    </RehearsalsCard>
  );
}

type AccountingCollectionRowProps = {
  collection: CollectionSummary;
};

function AccountingCollectionRow({ collection }: AccountingCollectionRowProps) {
  const progress = collectionProgressPercent(
    collection.paidRub,
    collection.expectedRub,
  );
  const progressRatio = Math.max(0, Math.min(100, progress)) / 100;
  const statusClass = cn(
    "accounting-status",
    collection.status === "active" && "accounting-status--active",
    collection.status === "closed" && "accounting-status--closed",
  );
  const dueLabel = collection.dueAt
    ? ` · до ${dayjs(collection.dueAt).format("D MMM")}`
    : "";

  return (
    <li>
      <Link
        to={accountingPath(collection.id)}
        className="accounting-list-item"
      >
        <div className="accounting-list-item__row">
          <div>
            <div className="accounting-list-item__title">
              {collection.title}
            </div>
            <div className="accounting-list-item__meta">
              <span>{collectionOwnerLabel(collection)}</span>
              {" · "}
              <span className={statusClass}>
                {collectionStatusLabel(collection.status)}
              </span>
              {" · "}
              {collection.paidParticipantCount} / {collection.participantCount}{" "}
              внесли
              {dueLabel}
            </div>
          </div>
          <div className="accounting-list-item__amount">
            {formatRub(collection.paidRub)} / {formatRub(collection.expectedRub)}
          </div>
        </div>
        <div className="accounting-progress">
          <div
            className="accounting-progress__fill"
            ref={(node) => {
              if (!node) return;
              node.style.setProperty(
                "--accounting-progress-ratio",
                String(progressRatio),
              );
            }}
          />
        </div>
      </Link>
    </li>
  );
}
