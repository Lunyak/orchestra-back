import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useState } from "react";
import { Link } from "react-router-dom";
import { globalPaths } from "../../app/router/paths";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import {
  premiseKindLabel,
  useCreatePremiseMutation,
  useListPremisesQuery,
} from "../../features/premises";

export type PremiseOrganizationScope =
  | { type: "theater"; id: string }
  | { type: "studio"; id: string };

type PremisesIndexPanelProps = {
  skip?: boolean;
  organization?: PremiseOrganizationScope;
  detailPath?: (premiseId: string) => string;
  canCreate?: boolean;
};

export function PremisesIndexPanel({
  skip = false,
  organization,
  detailPath,
  canCreate = true,
}: PremisesIndexPanelProps) {
  const listParams =
    organization?.type === "theater"
      ? { theaterId: organization.id }
      : organization?.type === "studio"
        ? { studioId: organization.id }
        : undefined;
  const { data, isLoading, error } = useListPremisesQuery(listParams, { skip });
  const [createPremise, { isLoading: creating }] = useCreatePremiseMutation();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const premises = data?.premises ?? [];
  const hasPremises = premises.length > 0;

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreateError(null);
    try {
      await createPremise({
        name: trimmed,
        address: address.trim() || undefined,
        ...(organization?.type === "theater"
          ? { theaterId: organization.id }
          : {}),
        ...(organization?.type === "studio"
          ? { studioId: organization.id }
          : {}),
      }).unwrap();
      setName("");
      setAddress("");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "data" in e
          ? String((e as { data?: { message?: string } }).data?.message ?? "")
          : "";
      setCreateError(msg || "Не удалось создать помещение");
    }
  }

  return (
    <div className="premises-index">
      {organization && canCreate ? (
        <RehearsalsCard fluid>
          <div className="rehearsals-card-title">Новое помещение</div>
          <FormInlineRow className="premises-form-row">
            <InlineTextField
              className="native-text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название, например «Большой зал»"
              maxLength={120}
              aria-label="Название помещения"
            />
            <InlineTextField
              className="native-text-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Адрес (необязательно)"
              maxLength={300}
              aria-label="Адрес"
            />
            <Button
              type="button"
              disabled={creating || !name.trim()}
              onClick={() => void handleCreate()}
            >
              {creating ? "Создание…" : "Добавить"}
            </Button>
          </FormInlineRow>
          {createError ? (
            <div className="rehearsals-error">{createError}</div>
          ) : null}
        </RehearsalsCard>
      ) : null}

      {isLoading ? (
        <PageLoader variant="view" label="Загрузка помещений…" />
      ) : error ? (
        <p className="premises-index__error" role="alert">
          Не удалось загрузить помещения
        </p>
      ) : hasPremises ? (
        <ul className="premises-poster-list">
          {premises.map((premise) => {
            const bookingLabel = premise.canBook
              ? "Можно бронировать"
              : "Только просмотр";
            const metaParts = [
              premise.address?.trim() || premise.ownerTitle,
              bookingLabel,
            ].filter(Boolean);
            const metaLabel = metaParts.join(" · ");

            return (
              <li key={premise.id}>
                <Link
                  to={
                    detailPath?.(premise.id) ??
                    `${globalPaths.premises}/${encodeURIComponent(premise.id)}`
                  }
                  className="premises-poster"
                >
                  <span className="premises-poster__frame premises-poster__frame--placeholder">
                    <span className="premises-poster__hint">
                      {premiseKindLabel(premise.kind)}
                    </span>
                  </span>
                  <span className="premises-poster__name">{premise.name}</span>
                  <span className="premises-poster__meta">{metaLabel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="premises-index__empty">
          <h2>Здесь пока нет помещений</h2>
          <p>Добавьте зал или студию, чтобы вести календарь аренды.</p>
        </div>
      )}
    </div>
  );
}
