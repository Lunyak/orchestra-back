import cn from "classnames";
import { useState } from "react";
import {
  CustomSelect,
  type CustomSelectOption,
} from "../../../shared/core/custom-select/CustomSelect";
import {
  RequisitesPanel,
  type RequisiteAssigneeOption,
  type RequisiteCreatePayload,
} from "../../../shared/components/show-script/components/RequisitesPanel";
import "../../../shared/components/show-script/style.css";
import type {
  SceneLightKadrRequisiteActionV1,
  SceneLightKadrRequisiteCueV1,
  ScriptRequisite,
  ScriptRequisiteDuty,
} from "../../../shared/types/script";

const REQUISITE_ACTION_OPTIONS: CustomSelectOption[] = [
  { value: "setup", label: "вынести" },
  { value: "strike", label: "убрать" },
  { value: "use", label: "использовать" },
];

function patchRequisiteAt(
  items: ScriptRequisite[],
  index: number,
  patch: (item: ScriptRequisite) => ScriptRequisite,
): ScriptRequisite[] {
  return items.map((item, itemIndex) =>
    itemIndex === index ? patch(item) : item,
  );
}

export function CreateKadrRequisitesSection({
  sceneRequisites,
  onSceneRequisitesChange,
  draftCues,
  onToggleCue,
  onCueActionChange,
  assigneeOptions,
  accessToken,
  projectSlug,
  defaultOpen = false,
  layout = "collapsible",
}: {
  sceneRequisites: ScriptRequisite[];
  onSceneRequisitesChange: (next: ScriptRequisite[]) => void;
  draftCues: SceneLightKadrRequisiteCueV1[];
  onToggleCue: (requisiteId: number, action?: SceneLightKadrRequisiteActionV1) => void;
  onCueActionChange: (
    requisiteId: number,
    action: SceneLightKadrRequisiteActionV1,
  ) => void;
  assigneeOptions: RequisiteAssigneeOption[];
  accessToken: string | null | undefined;
  projectSlug: string;
  defaultOpen?: boolean;
  layout?: "collapsible" | "flat";
}) {
  const isFlatLayout = layout === "flat";
  const [open, setOpen] = useState(defaultOpen || isFlatLayout);
  const [newRequisite, setNewRequisite] = useState("");
  const requisitesCount = sceneRequisites.length;
  const cuesCount = draftCues.length;
  const showRequisitesContent = isFlatLayout || open;

  const addRequisite = () => {
    const label = newRequisite.trim();
    if (!label) return;
    const nextId =
      sceneRequisites.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    onSceneRequisitesChange([
      ...sceneRequisites,
      { id: nextId, label, checked: false },
    ]);
    setNewRequisite("");
  };

  const createRequisite = (payload: RequisiteCreatePayload) => {
    const nextId =
      sceneRequisites.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const nextItem: ScriptRequisite = {
      id: nextId,
      label: payload.label,
      checked: false,
    };
    if (payload.duty) nextItem.duty = payload.duty;
    if (payload.assigneeEmail) {
      nextItem.assigneeEmail = payload.assigneeEmail.trim().toLowerCase();
    }
    if (payload.duty === "setup" && payload.placeNote) {
      nextItem.placeNote = payload.placeNote;
    }
    if (payload.duty === "use" && payload.actionNote) {
      nextItem.actionNote = payload.actionNote;
    }
    if (payload.avatarKey) nextItem.avatarKey = payload.avatarKey;

    onSceneRequisitesChange([...sceneRequisites, nextItem]);

    if (payload.includeInKadr) {
      const cueAction =
        payload.duty === "strike" || payload.duty === "use" || payload.duty === "setup"
          ? payload.duty
          : "setup";
      onToggleCue(nextId, cueAction);
    }
  };

  return (
    <section
      className={cn(
        "create-kadr-modal__section",
        "create-kadr-modal__requisites",
        isFlatLayout && "create-kadr-modal__requisites--flat",
        showRequisitesContent && "create-kadr-modal__requisites--open",
      )}
    >
      <div className="create-kadr-modal__requisites-head">
        {isFlatLayout ? (
          <div className="create-kadr-modal__requisites-head-title">
            <span className="create-kadr-modal__requisites-title">Реквизит</span>
            {requisitesCount > 0 ? (
              <span className="create-kadr-modal__requisites-count">
                {requisitesCount}
              </span>
            ) : null}
            {cuesCount > 0 ? (
              <span className="create-kadr-modal__requisites-cues">
                в картине: {cuesCount}
              </span>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="create-kadr-modal__requisites-toggle"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
          >
            <span className="create-kadr-modal__requisites-chevron" aria-hidden>
              {open ? "▾" : "▸"}
            </span>
            <span className="create-kadr-modal__requisites-title">Реквизит</span>
            {requisitesCount > 0 ? (
              <span className="create-kadr-modal__requisites-count">
                {requisitesCount}
              </span>
            ) : null}
            {cuesCount > 0 ? (
              <span className="create-kadr-modal__requisites-cues">
                в картине: {cuesCount}
              </span>
            ) : null}
          </button>
        )}
      </div>

      {showRequisitesContent ? (
        <RequisitesPanel
          show
          isEditing
          hideHeader
          hideBulkActions
          hideCheckedToggle
          requisites={sceneRequisites}
          assigneeOptions={assigneeOptions}
          newRequisite={newRequisite}
          setNewRequisite={setNewRequisite}
          onAdd={addRequisite}
          onCreate={createRequisite}
          showKadrCueOnCreate
          onRemove={(index) => {
            onSceneRequisitesChange(
              sceneRequisites.filter((_item, itemIndex) => itemIndex !== index),
            );
          }}
          onAssigneeChange={(index, email) => {
            const nextEmail = email?.trim().toLowerCase() || undefined;
            onSceneRequisitesChange(
              patchRequisiteAt(sceneRequisites, index, (item) => {
                if (!nextEmail) {
                  const { assigneeEmail: _removed, ...rest } = item;
                  return rest;
                }
                return { ...item, assigneeEmail: nextEmail };
              }),
            );
          }}
          onDutyChange={(index, duty: ScriptRequisiteDuty | null) => {
            onSceneRequisitesChange(
              patchRequisiteAt(sceneRequisites, index, (item) => {
                if (!duty) {
                  const { duty: _removed, ...rest } = item;
                  return rest;
                }
                return { ...item, duty };
              }),
            );
          }}
          onPlaceNoteChange={(index, note) => {
            const trimmed = note.trim();
            onSceneRequisitesChange(
              patchRequisiteAt(sceneRequisites, index, (item) => {
                if (!trimmed) {
                  const { placeNote: _removed, ...rest } = item;
                  return rest;
                }
                return { ...item, placeNote: note };
              }),
            );
          }}
          onActionNoteChange={(index, note) => {
            const trimmed = note.trim();
            onSceneRequisitesChange(
              patchRequisiteAt(sceneRequisites, index, (item) => {
                if (!trimmed) {
                  const { actionNote: _removed, ...rest } = item;
                  return rest;
                }
                return { ...item, actionNote: note };
              }),
            );
          }}
          onAvatarKeyChange={(index, avatarKey) => {
            const nextKey = String(avatarKey ?? "").trim() || undefined;
            onSceneRequisitesChange(
              patchRequisiteAt(sceneRequisites, index, (item) => {
                if (!nextKey) {
                  const { avatarKey: _removed, ...rest } = item;
                  return rest;
                }
                return { ...item, avatarKey: nextKey };
              }),
            );
          }}
          accessToken={accessToken}
          projectSlug={projectSlug}
          renderItemExtra={(item) => {
            const cue = draftCues.find((row) => row.requisiteId === item.id);
            const checked = cue != null;
            return (
              <div className="create-kadr-modal__requisite-cue">
                <label
                  className={cn(
                    "create-kadr-modal__check",
                    checked && "create-kadr-modal__check--active",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCue(item.id)}
                  />
                  <span>В эту картину</span>
                </label>
                {checked ? (
                  <CustomSelect
                    value={cue.action}
                    options={REQUISITE_ACTION_OPTIONS}
                    onChange={(value) =>
                      onCueActionChange(
                        item.id,
                        value as SceneLightKadrRequisiteActionV1,
                      )
                    }
                    searchable={false}
                    className="create-kadr-modal__requisite-action-select"
                    aria-label="Действие с реквизитом в картине"
                  />
                ) : null}
              </div>
            );
          }}
        />
      ) : null}
    </section>
  );
}
