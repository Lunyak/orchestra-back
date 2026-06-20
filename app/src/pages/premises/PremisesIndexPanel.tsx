import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import cn from "classnames";
import { useState } from "react";
import { Link } from "react-router-dom";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import {
  premiseKindLabel,
  useCreatePremiseMutation,
  useListPremisesQuery,
} from "../../features/premises";
import type { PremiseKind } from "../../sync/api/premises";

const kindOptions: { value: PremiseKind; label: string }[] = [
  { value: "OWNED", label: premiseKindLabel("OWNED") },
  { value: "RENTED", label: premiseKindLabel("RENTED") },
];

type PremisesIndexPanelProps = {
  skip?: boolean;
};

export function PremisesIndexPanel({ skip = false }: PremisesIndexPanelProps) {
  const { data, isLoading, error } = useListPremisesQuery(undefined, { skip });
  const [createPremise, { isLoading: creating }] = useCreatePremiseMutation();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<PremiseKind>("OWNED");
  const [address, setAddress] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const premises = data?.premises ?? [];

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreateError(null);
    try {
      await createPremise({
        name: trimmed,
        kind,
        address: address.trim() || undefined,
      }).unwrap();
      setName("");
      setAddress("");
      setKind("OWNED");
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
          <CustomSelect
            value={kind}
            options={kindOptions}
            onChange={(v) => setKind(v as PremiseKind)}
            aria-label="Тип помещения"
          />
        </FormInlineRow>
        <FormInlineRow className="premises-form-row">
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

      <RehearsalsCard fluid className="premises-index-list-card">
        <div className="rehearsals-card-title">Список помещений</div>
        {isLoading ? (
          <p className="rehearsals-muted">Загрузка…</p>
        ) : error ? (
          <div className="rehearsals-error">Не удалось загрузить помещения</div>
        ) : premises.length === 0 ? (
          <p className="rehearsals-muted">
            Помещений пока нет. Создайте первое — оно привяжется к вашей труппе.
          </p>
        ) : (
          <ul className="premises-list sessions-list">
            {premises.map((p) => (
              <li key={p.id}>
                <Link to={`/premises/${p.id}`} className="premises-list-item">
                  <div className="premises-list-item__main">
                    <span className="premises-list-item__name">{p.name}</span>
                    <span
                      className={cn(
                        "premises-page__kind",
                        p.kind === "OWNED"
                          ? "premises-page__kind--owned"
                          : "premises-page__kind--rented",
                      )}
                    >
                      {premiseKindLabel(p.kind)}
                    </span>
                  </div>
                  {p.address ? (
                    <div className="premises-list-item__address rehearsals-muted">
                      {p.address}
                    </div>
                  ) : null}
                  <div className="premises-list-item__meta rehearsals-muted">
                    {p.troupeTitle}
                    {p.canBook ? " · можно бронировать" : " · только просмотр"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </RehearsalsCard>
    </div>
  );
}
