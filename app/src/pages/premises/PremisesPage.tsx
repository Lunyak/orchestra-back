import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import cn from "classnames";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../features/auth";
import {
  premiseKindLabel,
  useCreatePremiseMutation,
  useListPremisesQuery,
} from "../../features/premises";
import type { PremiseKind } from "../../sync/api/premises";
import "./style.css";

const kindOptions: { value: PremiseKind; label: string }[] = [
  { value: "OWNED", label: premiseKindLabel("OWNED") },
  { value: "RENTED", label: premiseKindLabel("RENTED") },
];

export function PremisesPage() {
  const { accessToken } = useAuth();
  const { data, isLoading, error } = useListPremisesQuery(undefined, {
    skip: !accessToken,
  });
  const [createPremise, { isLoading: creating }] = useCreatePremiseMutation();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<PremiseKind>("OWNED");
  const [address, setAddress] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const premises = data?.premises ?? [];

  if (!accessToken) {
    return <div>Нужно войти, чтобы открыть помещения.</div>;
  }

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
    <div className="app-layout premises-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="premises-view">
            <div className="premises-header">
              <div>
                <h2 className="premises-header__title">Помещения</h2>
                <p className="premises-header__subtitle">
                  Календарь аренды и субаренды залов и студий
                </p>
              </div>
              <Link to="/troupe" className="premises-link-back">
                ← Труппа
              </Link>
            </div>

            <div className="premises-card">
              <div className="premises-card__title">Новое помещение</div>
              <FormInlineRow className="premises-form-row">
                <InlineTextField
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
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Адрес (необязательно)"
                  maxLength={300}
                  aria-label="Адрес"
                />
                <Button
                  type="button"
                  variant="primary"
                  disabled={creating || !name.trim()}
                  onClick={() => void handleCreate()}
                >
                  {creating ? "Создание…" : "Добавить"}
                </Button>
              </FormInlineRow>
              {createError ? (
                <div className="premises-error">{createError}</div>
              ) : null}
            </div>

            <div className="premises-card">
              <div className="premises-card__title">Список помещений</div>
              {isLoading ? (
                <p className="premises-hint">Загрузка…</p>
              ) : error ? (
                <div className="premises-error">Не удалось загрузить помещения</div>
              ) : premises.length === 0 ? (
                <p className="premises-hint">
                  Помещений пока нет. Создайте первое — оно привяжется к вашей
                  труппе.
                </p>
              ) : (
                <ul className="premises-list">
                  {premises.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/premises/${p.id}`}
                        className="premises-list-item"
                      >
                        <div className="premises-list-item__main">
                          <span className="premises-list-item__name">{p.name}</span>
                          <span
                            className={cn(
                              "premises-list-item__kind",
                              p.kind === "OWNED"
                                ? "premises-list-item__kind--owned"
                                : "premises-list-item__kind--rented",
                            )}
                          >
                            {premiseKindLabel(p.kind)}
                          </span>
                        </div>
                        {p.address ? (
                          <div className="premises-list-item__address">
                            {p.address}
                          </div>
                        ) : null}
                        <div className="premises-list-item__meta">
                          {p.troupeTitle}
                          {p.canBook
                            ? " · можно бронировать"
                            : " · только просмотр"}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
