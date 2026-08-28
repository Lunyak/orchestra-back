import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import type {
  MemberOption,
  ParticipantDraft,
  TariffDraft,
} from "../model/accounting-page-types";

type AccountingCreateFormProps = {
  title: string;
  onTitleChange: (value: string) => void;
  formError: string | null;
  tariffs: TariffDraft[];
  participantDrafts: ParticipantDraft[];
  memberOptions: MemberOption[];
  creating: boolean;
  onAddTariff: () => void;
  onRemoveTariff: (key: string) => void;
  onTariffChange: (
    key: string,
    patch: Partial<Pick<TariffDraft, "title" | "amountRub">>,
  ) => void;
  onParticipantChange: (
    email: string,
    patch: Partial<Pick<ParticipantDraft, "selected" | "tariffIndex">>,
  ) => void;
  onCreate: () => void;
};

export function AccountingCreateForm({
  title,
  onTitleChange,
  formError,
  tariffs,
  participantDrafts,
  memberOptions,
  creating,
  onAddTariff,
  onRemoveTariff,
  onTariffChange,
  onParticipantChange,
  onCreate,
}: AccountingCreateFormProps) {
  const canRemoveTariff = tariffs.length > 1;
  const hasMembers = memberOptions.length > 0;
  const createLabel = creating ? "Создание…" : "Создать сбор";

  return (
    <div className="accounting-form-section">
      <h2 className="accounting-form-section__title">Новый сбор</h2>
      {formError ? (
        <p className="accounting-page__error">{formError}</p>
      ) : null}

      <FormInlineRow className="accounting-form-row">
        <label className="accounting-scope-row__field">
          <span>Название</span>
          <InlineTextField
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Аренда зала, март"
          />
        </label>
      </FormInlineRow>

      <h3 className="accounting-form-section__title">Тарифы</h3>
      <ul className="accounting-tariff-list">
        {tariffs.map((row) => (
          <li key={row.key} className="accounting-tariff-item">
            <label className="accounting-scope-row__field">
              <span>Тариф</span>
              <InlineTextField
                value={row.title}
                onChange={(event) =>
                  onTariffChange(row.key, { title: event.target.value })
                }
              />
            </label>
            <label className="accounting-scope-row__field">
              <span>₽</span>
              <InlineTextField
                value={row.amountRub}
                onChange={(event) =>
                  onTariffChange(row.key, { amountRub: event.target.value })
                }
              />
            </label>
            {canRemoveTariff ? (
              <Button type="button" onClick={() => onRemoveTariff(row.key)}>
                Удалить
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <Button type="button" onClick={onAddTariff}>
        + Тариф
      </Button>

      <h3 className="accounting-form-section__title">Кто скидывается</h3>
      {!hasMembers ? (
        <p>Сначала добавьте участников в выбранную сущность.</p>
      ) : (
        <ul className="accounting-participant-list">
          {participantDrafts.map((row) => {
            const member = memberOptions.find(
              (item) => item.email === row.email,
            );
            const label = member?.displayName ?? row.email;
            return (
              <li key={row.email} className="accounting-participant-item">
                <label className="accounting-participant-item__label">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(event) =>
                      onParticipantChange(row.email, {
                        selected: event.target.checked,
                      })
                    }
                  />{" "}
                  {label}
                </label>
                {row.selected ? (
                  <select
                    value={row.tariffIndex}
                    onChange={(event) =>
                      onParticipantChange(row.email, {
                        tariffIndex: Number(event.target.value),
                      })
                    }
                  >
                    {tariffs.map((tariff, index) => {
                      const tariffLabel = tariff.title || `Тариф ${index + 1}`;
                      const amountSuffix = tariff.amountRub
                        ? ` — ${tariff.amountRub} ₽`
                        : "";
                      return (
                        <option key={tariff.key} value={index}>
                          {tariffLabel}
                          {amountSuffix}
                        </option>
                      );
                    })}
                  </select>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="accounting-actions">
        <Button type="button" onClick={onCreate} disabled={creating}>
          {createLabel}
        </Button>
      </div>
    </div>
  );
}
