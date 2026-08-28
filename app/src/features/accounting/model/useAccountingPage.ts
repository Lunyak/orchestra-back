import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { useGetStudioQuery } from "../../studio";
import { memberLabel } from "../../troupe";
import { useMyTroupeQuery } from "../../troupe/api/troupe-api";
import {
  useCreateCollectionMutation,
  useListCollectionsQuery,
} from "../api/accounting-api";
import { accountingListErrorMessage } from "./accounting-list-error";
import {
  buildVisibleTabs,
  DEFAULT_TARIFFS,
  emptyScopes,
  filterCollections,
  newTariffDraft,
  resolveDefaultTab,
} from "./accounting-page-helpers";
import type {
  AccountingTab,
  MemberOption,
  ParticipantDraft,
  TariffDraft,
  TroupeOption,
} from "./accounting-page-types";
import { parseRubInput } from "./format-rub";

dayjs.locale("ru");

export function useAccountingPage() {
  const { accessToken } = useAuth();
  const location = useLocation();
  const {
    data: collectionsData,
    isLoading,
    isError,
    error,
  } = useListCollectionsQuery(undefined, { skip: !accessToken });
  const { data: troupeData } = useMyTroupeQuery({}, { skip: !accessToken });
  const [createCollection, { isLoading: creating }] =
    useCreateCollectionMutation();

  const scopes = collectionsData?.scopes ?? emptyScopes();
  const [activeTab, setActiveTab] = useState<AccountingTab | null>(null);
  const [entityId, setEntityId] = useState("");
  const [troupeId, setTroupeId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [tariffs, setTariffs] = useState<TariffDraft[]>(DEFAULT_TARIFFS);
  const [formError, setFormError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);

  const resolvedTab = activeTab ?? resolveDefaultTab(scopes);
  const selectedStudioId =
    resolvedTab === "studios" && entityId ? entityId : "";
  const { data: studioDetail } = useGetStudioQuery(selectedStudioId, {
    skip: !accessToken || !selectedStudioId,
  });

  useEffect(() => {
    if (activeTab != null) return;
    const nextTab = resolveDefaultTab(scopes);
    if (nextTab) setActiveTab(nextTab);
  }, [activeTab, scopes]);

  useEffect(() => {
    if (!resolvedTab) {
      setEntityId("");
      setTroupeId("");
      return;
    }
    if (resolvedTab === "theaters") {
      const theater = scopes.theaters.find((item) => item.id === entityId);
      const firstTheater = scopes.theaters[0];
      const nextTheater = theater ?? firstTheater;
      if (!nextTheater) {
        setEntityId("");
        setTroupeId("");
        return;
      }
      if (entityId !== nextTheater.id) setEntityId(nextTheater.id);
      const hasTroupe = nextTheater.troupes.some((item) => item.id === troupeId);
      if (!hasTroupe) setTroupeId(nextTheater.troupes[0]?.id ?? "");
      return;
    }
    if (resolvedTab === "studios") {
      const studio = scopes.studios.find((item) => item.id === entityId);
      const nextStudio = studio ?? scopes.studios[0];
      setEntityId(nextStudio?.id ?? "");
      setTroupeId("");
      return;
    }
    const project = scopes.projects.find((item) => item.id === entityId);
    const nextProject = project ?? scopes.projects[0];
    if (!nextProject) {
      setEntityId("");
      setTroupeId("");
      return;
    }
    if (entityId !== nextProject.id) setEntityId(nextProject.id);
    const hasTroupe = nextProject.troupeIds.includes(troupeId);
    if (!hasTroupe) setTroupeId(nextProject.troupeIds[0] ?? "");
  }, [resolvedTab, scopes, entityId, troupeId]);

  const membersFromApi = collectionsData?.createMemberOptions ?? [];
  const membersFromTroupe: MemberOption[] = (troupeData?.members ?? []).map(
    (member) => ({
      email: member.email,
      displayName: memberLabel(member),
    }),
  );
  const membersFromStudio: MemberOption[] = (studioDetail?.members ?? []).map(
    (member) => ({
      email: member.email,
      displayName: member.displayName?.trim() || member.email,
    }),
  );

  const memberOptions =
    resolvedTab === "studios"
      ? membersFromStudio.length > 0
        ? membersFromStudio
        : membersFromApi
      : membersFromApi.length > 0
        ? membersFromApi
        : membersFromTroupe;

  const participantDrafts =
    participants.length === memberOptions.length
      ? participants
      : memberOptions.map((member) => {
          const existing = participants.find((row) => row.email === member.email);
          return (
            existing ?? {
              email: member.email,
              selected: false,
              tariffIndex: 0,
            }
          );
        });

  const allCollections = collectionsData?.collections ?? [];
  const collections =
    resolvedTab != null
      ? filterCollections(allCollections, resolvedTab, scopes, entityId)
      : [];

  const canCreateFromApi = collectionsData?.canCreateCollections;
  const canManageAnyCollection = allCollections.some(
    (collection) => collection.canManage,
  );
  const canCreate =
    Boolean(accessToken) &&
    (canCreateFromApi !== false || canManageAnyCollection || isError);
  const createBlocked =
    !isLoading &&
    !isError &&
    canCreateFromApi === false &&
    !canManageAnyCollection;

  const visibleTabs = buildVisibleTabs(scopes);

  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate && canCreate) {
      setShowCreate(true);
    }
  }, [location.state, canCreate]);

  const handleTabChange = (tab: AccountingTab) => {
    setActiveTab(tab);
    setEntityId("");
    setTroupeId("");
    setShowCreate(false);
    setFormError(null);
  };

  const handleToggleCreate = () => {
    setShowCreate((value) => !value);
    setFormError(null);
  };

  const handleAddTariff = () => {
    setTariffs((rows) => [...rows, newTariffDraft()]);
  };

  const handleRemoveTariff = (key: string) => {
    setTariffs((rows) => rows.filter((row) => row.key !== key));
  };

  const handleTariffChange = (
    key: string,
    patch: Partial<Pick<TariffDraft, "title" | "amountRub">>,
  ) => {
    setTariffs((rows) =>
      rows.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const handleParticipantChange = (
    email: string,
    patch: Partial<Pick<ParticipantDraft, "selected" | "tariffIndex">>,
  ) => {
    setParticipants(() =>
      participantDrafts.map((row) =>
        row.email === email ? { ...row, ...patch } : row,
      ),
    );
  };

  const handleCreate = async () => {
    setFormError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Укажите название сбора");
      return;
    }

    const parsedTariffs = tariffs.map((row) => {
      const amountRub = parseRubInput(row.amountRub);
      const tariffTitle = row.title.trim();
      if (!tariffTitle || amountRub == null) return null;
      return { title: tariffTitle, amountRub };
    });

    if (parsedTariffs.some((row) => row == null)) {
      setFormError("Заполните все тарифы (название и сумма в ₽)");
      return;
    }

    const validTariffs = parsedTariffs.filter(
      (row): row is { title: string; amountRub: number } => row != null,
    );
    if (validTariffs.length === 0) {
      setFormError("Добавьте хотя бы один тариф");
      return;
    }

    const selectedParticipants = participantDrafts
      .filter((row) => row.selected)
      .map((row) => ({
        email: row.email,
        tariffIndex: row.tariffIndex,
      }));

    if (selectedParticipants.length === 0) {
      setFormError("Выберите хотя бы одного участника");
      return;
    }

    if (resolvedTab === "studios" && !entityId) {
      setFormError("Выберите студию");
      return;
    }
    if (resolvedTab !== "studios" && !troupeId) {
      setFormError("Выберите труппу");
      return;
    }

    try {
      await createCollection({
        title: trimmedTitle,
        tariffs: validTariffs,
        participants: selectedParticipants,
        ...(resolvedTab === "studios"
          ? { studioId: entityId }
          : { troupeId }),
      }).unwrap();
      setTitle("");
      setShowCreate(false);
      setParticipants([]);
    } catch (createError) {
      setFormError(
        createError instanceof Error
          ? createError.message
          : "Не удалось создать сбор",
      );
    }
  };

  const errorMessage = isError ? accountingListErrorMessage(error) : null;
  const selectedTheater = scopes.theaters.find((item) => item.id === entityId);
  const selectedProject = scopes.projects.find((item) => item.id === entityId);

  const titleByTroupeId = new Map<string, string>();
  for (const theater of scopes.theaters) {
    for (const troupe of theater.troupes) {
      titleByTroupeId.set(troupe.id, troupe.title);
    }
  }

  const projectTroupeOptions: TroupeOption[] = selectedProject
    ? selectedProject.troupeIds.map((id) => ({
        id,
        title: titleByTroupeId.get(id) ?? id,
      }))
    : [];

  const theaterTroupeOptions: TroupeOption[] = selectedTheater?.troupes ?? [];
  const pageBooting = Boolean(accessToken) && isLoading && !collectionsData;

  return {
    accessToken,
    pageBooting,
    isLoading,
    resolvedTab,
    entityId,
    setEntityId,
    troupeId,
    setTroupeId,
    showCreate,
    title,
    setTitle,
    tariffs,
    formError,
    participantDrafts,
    memberOptions,
    scopes,
    collections,
    canCreate,
    createBlocked,
    visibleTabs,
    creating,
    errorMessage,
    theaterTroupeOptions,
    projectTroupeOptions,
    handleTabChange,
    handleToggleCreate,
    handleAddTariff,
    handleRemoveTariff,
    handleTariffChange,
    handleParticipantChange,
    handleCreate,
  };
}
