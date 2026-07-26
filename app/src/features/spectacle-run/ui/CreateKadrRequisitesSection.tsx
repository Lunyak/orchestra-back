import cn from "classnames";
import { useState } from "react";
import {
  CustomSelect,
  type CustomSelectOption,
} from "../../../shared/core/custom-select/CustomSelect";
import {
  RequisitesPanel,
  type RequisiteAssigneeOption,
  type TheaterRequisiteCandidate,
} from "../../../shared/components/show-script/components/RequisitesPanel";
import "../../../shared/components/show-script/style.css";
import type {
  SceneLightKadrRequisiteActionV1,
  SceneLightKadrRequisiteCueV1,
  ScriptRequisite,
  ScriptRequisiteDuty,
  TheaterModel,
} from "../../../shared/types/script";
import {
  addRequisiteFromTheaterModel,
  listTheaterRequisiteCandidates,
} from "../../theater/model/theater-decor-inventory";

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
  theaterModels,
  draftCues,
  onToggleCue,
  onCueActionChange,
  assigneeOptions,
  accessToken,
  projectSlug,
  defaultOpen = false,
}: {
  sceneRequisites: ScriptRequisite[];
  onSceneRequisitesChange: (next: ScriptRequisite[]) => void;
  theaterModels: TheaterModel[];
  draftCues: SceneLightKadrRequisiteCueV1[];
  onToggleCue: (requisiteId: number) => void;
  onCueActionChange: (
    requisiteId: number,
    action: SceneLightKadrRequisiteActionV1,
  ) => void;
  assigneeOptions: RequisiteAssigneeOption[];
  accessToken: string | null | undefined;
  projectSlug: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [theaterPickerOpen, setTheaterPickerOpen] = useState(false);
  const [newRequisite, setNewRequisite] = useState("");
  const theaterCandidates: TheaterRequisiteCandidate[] =
    listTheaterRequisiteCandidates(theaterModels, sceneRequisites);
  const requisitesCount = sceneRequisites.length;
  const cuesCount = draftCues.length;

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

  const addFromTheater = (theaterModelId: number) => {
    const model = theaterModels.find((item) => item.id === theaterModelId);
    if (!model) return;
    const next = addRequisiteFromTheaterModel(sceneRequisites, model);
    if (next !== sceneRequisites) onSceneRequisitesChange(next);
  };

  const toggleTheaterPicker = () => {
    setOpen(true);
    setTheaterPickerOpen((prev) => !prev);
  };

  return (
    <section
      className={cn(
        "create-kadr-modal__section",
        "create-kadr-modal__requisites",
        open && "create-kadr-modal__requisites--open",
      )}
    >
      <div className="create-kadr-modal__requisites-head">
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
        <button
          type="button"
          className={cn(
            "requisites-action-btn",
            "requisites-action-btn--theater",
            theaterPickerOpen && "requisites-action-btn--active",
          )}
          onClick={toggleTheaterPicker}
          title="Добавить из 3D"
        >
          3D
        </button>
      </div>

      {open ? (
        <RequisitesPanel
          show
          isEditing
          hideHeader
          hideBulkActions
          hideCheckedToggle
          theaterPickerOpen={theaterPickerOpen}
          onTheaterPickerOpenChange={setTheaterPickerOpen}
          requisites={sceneRequisites}
          theaterCandidates={theaterCandidates}
          assigneeOptions={assigneeOptions}
          newRequisite={newRequisite}
          setNewRequisite={setNewRequisite}
          onAdd={addRequisite}
          onAddFromTheater={addFromTheater}
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
