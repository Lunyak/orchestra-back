import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PremiseKind, PremiseSummary } from "../../../sync/api/premises";
import { createAvailabilityForm } from "./premise-detail-forms";
import type { AvailabilityFormDay } from "./premise-detail-types";
import {
  buildUpdatePremiseBody,
  extractError,
  validateSettingsForm,
} from "./premise-detail-helpers";
import type { PremiseDetailData } from "./usePremiseDetailData";

export function usePremiseDetailSettings(input: {
  premiseId: string;
  premise: PremiseSummary | undefined;
  premisesPath: string;
  updatePremise: PremiseDetailData["updatePremise"];
  updatingPremise: boolean;
  deletePremise: PremiseDetailData["deletePremise"];
  deletingPremise: boolean;
}) {
  const {
    premiseId,
    premise,
    premisesPath,
    updatePremise,
    updatingPremise,
    deletePremise,
    deletingPremise,
  } = input;
  const navigate = useNavigate();

  const [settingsName, setSettingsName] = useState("");
  const [settingsKind, setSettingsKind] = useState<PremiseKind>("OWNED");
  const [settingsAddress, setSettingsAddress] = useState("");
  const [settingsCapacity, setSettingsCapacity] = useState("");
  const [settingsAvailability, setSettingsAvailability] = useState<
    AvailabilityFormDay[]
  >(() => createAvailabilityForm());
  const [settingsNotes, setSettingsNotes] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (!premise) return;
    setSettingsName(premise.name);
    setSettingsKind(premise.kind);
    setSettingsAddress(premise.address ?? "");
    setSettingsCapacity(
      premise.capacity == null ? "" : String(premise.capacity),
    );
    setSettingsAvailability(createAvailabilityForm(premise.weeklyAvailability));
    setSettingsNotes(premise.notes ?? "");
  }, [premise]);

  function updateAvailabilityDay(
    weekday: number,
    patch: Partial<
      Pick<AvailabilityFormDay, "enabled" | "startsAtMin" | "endsAtMin">
    >,
  ) {
    setSettingsAvailability((days) =>
      days.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
  }

  async function handleSaveSettings() {
    const validationError = validateSettingsForm({
      name: settingsName,
      capacity: settingsCapacity,
      availability: settingsAvailability,
    });
    if (validationError) {
      setSettingsError(validationError);
      return;
    }
    setSettingsError(null);
    try {
      await updatePremise({
        id: premiseId,
        body: buildUpdatePremiseBody({
          name: settingsName,
          kind: settingsKind,
          address: settingsAddress,
          capacity: settingsCapacity,
          availability: settingsAvailability,
          notes: settingsNotes,
        }),
      }).unwrap();
    } catch (e: unknown) {
      setSettingsError(extractError(e, "Не удалось сохранить помещение"));
    }
  }

  async function handleDeletePremise() {
    if (!premise) return;
    if (!confirm(`Удалить помещение «${premise.name}» и все его брони?`)) {
      return;
    }
    try {
      await deletePremise(premiseId).unwrap();
      navigate(premisesPath);
    } catch (e: unknown) {
      setSettingsError(extractError(e, "Не удалось удалить помещение"));
    }
  }

  return {
    settingsName,
    setSettingsName,
    settingsKind,
    setSettingsKind,
    settingsAddress,
    setSettingsAddress,
    settingsCapacity,
    setSettingsCapacity,
    settingsAvailability,
    setSettingsAvailability,
    settingsNotes,
    setSettingsNotes,
    settingsError,
    setSettingsError,
    updatingPremise,
    deletingPremise,
    updateAvailabilityDay,
    handleSaveSettings,
    handleDeletePremise,
  };
}
