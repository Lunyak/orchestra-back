import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { applyPreviewLineEdits } from "./apply-preview-line-edits";
import {
  detectFormatWarnings,
  formatWarningsSummary,
  type FormatWarning,
} from "./detect-format-warnings";
import {
  detectRoleNamesForFormatting,
  formatPlayText,
  hasCastListSection,
  type FormatPlayTextResult,
} from "./formatPlayText";
import {
  createRoleMarkerEntry,
  entriesFromDetectedNames,
  formatAliasesInput,
  mergeDetectedRoleEntries,
  parseAliasesInput,
  renameRoleMarkerEntry,
  roleEntriesToMarkerSpecs,
  type RoleMarkerEntry,
} from "./role-marker-entries";
import {
  deriveSceneTitleFromChunk,
  splitPlayTextIntoChunks,
} from "./splitPlayTextIntoChunks";

const ALIAS_DEBOUNCE_MS = 400;

export type FormatPlayTextModalProps = {
  isOpen: boolean;
  sourceText: string;
  onClose: () => void;
  onApply: (text: string) => void;
  onApplySplit?: (args: {
    chunks: string[];
    chunkTitles: string[];
  }) => void;
};

export type FormatPlayTextModalViewModel = ReturnType<typeof useFormatPlayTextModal>;

export function useFormatPlayTextModal({
  isOpen,
  sourceText,
  onClose,
  onApply,
  onApplySplit,
}: FormatPlayTextModalProps) {
  const titleId = useId();
  const markersFieldId = useId();
  const customRoleFieldId = useId();
  const lineEditFieldId = useId();

  const [mergeBrokenLines, setMergeBrokenLines] = useState(true);
  const [wrapRoleLabels, setWrapRoleLabels] = useState(true);
  const [trimExtraSpaces, setTrimExtraSpaces] = useState(true);
  const [stripLabelDots, setStripLabelDots] = useState(true);
  const [cleanOcr, setCleanOcr] = useState(true);
  const [removeOcrNoise, setRemoveOcrNoise] = useState(false);
  const [formatCastList, setFormatCastList] = useState(true);
  const [protectTitlePage, setProtectTitlePage] = useState(true);
  const [useRoleMarkers, setUseRoleMarkers] = useState(true);
  const [useRoleAliases, setUseRoleAliases] = useState(false);
  const [splitIntoScenes, setSplitIntoScenes] = useState(false);
  const [roleEntries, setRoleEntries] = useState<RoleMarkerEntry[]>([]);
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, string>>({});
  const [customRoleDraft, setCustomRoleDraft] = useState("");
  const [lineEdits, setLineEdits] = useState<Record<number, string>>({});
  const [editingLineNo, setEditingLineNo] = useState<number | null>(null);
  const [lineEditDraft, setLineEditDraft] = useState("");
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameEditDraft, setNameEditDraft] = useState("");

  const wasOpenRef = useRef(false);
  const aliasDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliasPendingRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;
    setMergeBrokenLines(true);
    setWrapRoleLabels(true);
    setTrimExtraSpaces(true);
    setStripLabelDots(true);
    setCleanOcr(true);
    setRemoveOcrNoise(false);
    setFormatCastList(true);
    setProtectTitlePage(true);
    setUseRoleMarkers(true);
    setUseRoleAliases(false);
    setSplitIntoScenes(false);
    setAliasDrafts({});
    aliasPendingRef.current = {};
    if (aliasDebounceRef.current) {
      clearTimeout(aliasDebounceRef.current);
      aliasDebounceRef.current = null;
    }
    setCustomRoleDraft("");
    setLineEdits({});
    setEditingLineNo(null);
    setLineEditDraft("");
    setEditingNameId(null);
    setNameEditDraft("");
    setRoleEntries(
      entriesFromDetectedNames(detectRoleNamesForFormatting(sourceText, { cleanOcr: true })),
    );
  }, [isOpen, sourceText]);

  const roleEntryIds = useMemo(
    () => roleEntries.map((entry) => entry.id).join("\0"),
    [roleEntries],
  );

  useEffect(() => {
    setAliasDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const entry of roleEntries) {
        next[entry.id] = prev[entry.id] ?? formatAliasesInput(entry.aliases);
      }
      return next;
    });
  }, [roleEntryIds, roleEntries]);

  const roleMarkerSpecs = useMemo(() => {
    const specs = roleEntriesToMarkerSpecs(roleEntries);
    if (!useRoleAliases) return specs.map((spec) => ({ ...spec, aliases: [] }));
    return specs;
  }, [roleEntries, useRoleAliases]);

  const enabledRoleCount = roleMarkerSpecs.length;
  const castListDetected = useMemo(
    () => hasCastListSection(sourceText, { cleanOcr }),
    [cleanOcr, sourceText],
  );

  const preview = useMemo(
    () =>
      formatPlayText(sourceText, {
        mergeBrokenLines,
        wrapRoleLabels,
        trimExtraSpaces,
        stripLabelDots,
        cleanOcr,
        removeOcrNoise,
        formatCastList,
        protectTitlePage,
        roleMarkerSpecs: useRoleMarkers ? roleMarkerSpecs : [],
      }),
    [
      cleanOcr,
      formatCastList,
      mergeBrokenLines,
      protectTitlePage,
      removeOcrNoise,
      roleMarkerSpecs,
      sourceText,
      stripLabelDots,
      trimExtraSpaces,
      useRoleMarkers,
      wrapRoleLabels,
    ],
  );

  const displayPreviewText = useMemo(
    () => applyPreviewLineEdits(preview.text, lineEdits),
    [lineEdits, preview.text],
  );

  const displayWarnings = useMemo(
    () => detectFormatWarnings(displayPreviewText),
    [displayPreviewText],
  );

  const sceneChunks = useMemo(
    () => (splitIntoScenes ? splitPlayTextIntoChunks(displayPreviewText) : []),
    [displayPreviewText, splitIntoScenes],
  );

  const refreshDetectedRoles = useCallback(() => {
    setRoleEntries((prev) =>
      mergeDetectedRoleEntries(
        detectRoleNamesForFormatting(sourceText, { cleanOcr, castListOnly: true }),
        prev,
      ),
    );
  }, [cleanOcr, sourceText]);

  const setAllRolesEnabled = useCallback((enabled: boolean) => {
    setRoleEntries((prev) => prev.map((entry) => ({ ...entry, enabled })));
  }, []);

  const toggleRoleEntry = useCallback((id: string, enabled: boolean) => {
    setRoleEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, enabled } : entry)),
    );
  }, []);

  const flushAliasCommits = useCallback(() => {
    const pending = aliasPendingRef.current;
    const pendingIds = Object.keys(pending);
    if (!pendingIds.length) return;
    aliasPendingRef.current = {};
    setRoleEntries((prev) =>
      prev.map((entry) => {
        const raw = pending[entry.id];
        if (raw === undefined) return entry;
        return { ...entry, aliases: parseAliasesInput(raw) };
      }),
    );
  }, []);

  const handleAliasChange = useCallback(
    (id: string, raw: string) => {
      setAliasDrafts((prev) => ({ ...prev, [id]: raw }));
      aliasPendingRef.current[id] = raw;
      if (aliasDebounceRef.current) clearTimeout(aliasDebounceRef.current);
      aliasDebounceRef.current = setTimeout(() => {
        aliasDebounceRef.current = null;
        flushAliasCommits();
      }, ALIAS_DEBOUNCE_MS);
    },
    [flushAliasCommits],
  );

  const handleAliasBlur = useCallback(() => {
    if (aliasDebounceRef.current) {
      clearTimeout(aliasDebounceRef.current);
      aliasDebounceRef.current = null;
    }
    flushAliasCommits();
  }, [flushAliasCommits]);

  useEffect(
    () => () => {
      if (aliasDebounceRef.current) clearTimeout(aliasDebounceRef.current);
    },
    [],
  );

  const resolveRoleEntriesForApply = useCallback((): RoleMarkerEntry[] => {
    return roleEntries.map((entry) => {
      if (!useRoleAliases) return { ...entry, aliases: [] };
      const raw = aliasPendingRef.current[entry.id] ?? aliasDrafts[entry.id];
      if (raw === undefined) return entry;
      return { ...entry, aliases: parseAliasesInput(raw) };
    });
  }, [aliasDrafts, roleEntries, useRoleAliases]);

  const startNameEdit = useCallback((entry: RoleMarkerEntry) => {
    setEditingNameId(entry.id);
    setNameEditDraft(entry.name);
  }, []);

  const cancelNameEdit = useCallback(() => {
    setEditingNameId(null);
    setNameEditDraft("");
  }, []);

  const saveNameEdit = useCallback(() => {
    if (!editingNameId) return;
    setRoleEntries((prev) => {
      const current = prev.find((entry) => entry.id === editingNameId);
      if (!current) return prev;
      const renamed = renameRoleMarkerEntry(current, nameEditDraft);
      if (!renamed) return prev;
      const withoutDupes = prev.filter(
        (entry) => entry.id !== editingNameId && entry.id !== renamed.id,
      );
      const existing = prev.find((entry) => entry.id === renamed.id);
      if (existing && existing.id !== editingNameId) {
        return [
          ...withoutDupes,
          {
            ...existing,
            enabled: existing.enabled || renamed.enabled,
            aliases: Array.from(new Set([...existing.aliases, ...renamed.aliases])),
            isCustom: existing.isCustom || renamed.isCustom,
          },
        ];
      }
      return [...withoutDupes, renamed];
    });
    setEditingNameId(null);
    setNameEditDraft("");
  }, [editingNameId, nameEditDraft]);

  const addCustomRole = useCallback(() => {
    const entry = createRoleMarkerEntry(customRoleDraft, { isCustom: true });
    if (!entry) return;
    setRoleEntries((prev) => {
      const existing = prev.find((item) => item.id === entry.id);
      if (existing) {
        return prev.map((item) =>
          item.id === entry.id
            ? { ...item, enabled: true, name: entry.name, isCustom: true }
            : item,
        );
      }
      return [...prev, entry];
    });
    setCustomRoleDraft("");
  }, [customRoleDraft]);

  const openLineEdit = useCallback(
    (lineNo: number, line: string) => {
      setEditingLineNo(lineNo);
      setLineEditDraft(lineEdits[lineNo] ?? line);
    },
    [lineEdits],
  );

  const saveLineEdit = useCallback(() => {
    if (editingLineNo === null) return;
    setLineEdits((prev) => ({ ...prev, [editingLineNo]: lineEditDraft }));
    setEditingLineNo(null);
    setLineEditDraft("");
  }, [editingLineNo, lineEditDraft]);

  const cancelLineEdit = useCallback(() => {
    setEditingLineNo(null);
    setLineEditDraft("");
  }, []);

  const hasSourceText = sourceText.trim().length > 0;
  const previewUnchanged = displayPreviewText === sourceText;
  const hasUnmatchedMarkers =
    useRoleMarkers &&
    preview.stats.unmatchedMarkers.length > 0 &&
    preview.stats.inlineSplits === 0;
  const splitBlocked = splitIntoScenes && sceneChunks.length <= 1;
  const lineEditCount = Object.keys(lineEdits).length;

  const previewWarningByLine = useMemo(() => {
    const map = new Map<number, string>();
    for (const warning of displayWarnings) {
      const prev = map.get(warning.line);
      map.set(warning.line, prev ? `${prev}; ${warning.message}` : warning.message);
    }
    return map;
  }, [displayWarnings]);

  const warningsSummary = useMemo(
    () => formatWarningsSummary(displayWarnings),
    [displayWarnings],
  );

  const canApply =
    hasSourceText &&
    (!previewUnchanged || preview.stats.inlineSplits > 0 || splitIntoScenes || lineEditCount > 0) &&
    !hasUnmatchedMarkers &&
    !splitBlocked;

  const applyDisabledTitle = hasUnmatchedMarkers
    ? "Сначала исправьте роли — их нет в тексте"
    : splitBlocked
      ? "Добавьте в текст «Акт», «Сцена» или «Картина» для нарезки"
      : undefined;

  const handleApply = useCallback(() => {
    handleAliasBlur();
    const applySpecs = roleEntriesToMarkerSpecs(resolveRoleEntriesForApply());
    const formattedText = formatPlayText(sourceText, {
      mergeBrokenLines,
      wrapRoleLabels,
      trimExtraSpaces,
      stripLabelDots,
      cleanOcr,
      removeOcrNoise,
      formatCastList,
      protectTitlePage,
      roleMarkerSpecs: useRoleMarkers ? applySpecs : [],
    }).text;
    const textToApply = applyPreviewLineEdits(formattedText, lineEdits);
    if (splitIntoScenes && onApplySplit) {
      const applyChunks = splitPlayTextIntoChunks(textToApply);
      if (applyChunks.length > 1) {
        const chunkTitles = applyChunks.map((chunk, index) =>
          deriveSceneTitleFromChunk(chunk, `Сцена ${index + 1}`),
        );
        onApplySplit({ chunks: applyChunks, chunkTitles });
      } else {
        onApply(textToApply);
      }
    } else {
      onApply(textToApply);
    }
    onClose();
  }, [
    cleanOcr,
    formatCastList,
    handleAliasBlur,
    lineEdits,
    mergeBrokenLines,
    onApply,
    onApplySplit,
    onClose,
    protectTitlePage,
    removeOcrNoise,
    resolveRoleEntriesForApply,
    sourceText,
    splitIntoScenes,
    stripLabelDots,
    trimExtraSpaces,
    useRoleMarkers,
    wrapRoleLabels,
  ]);

  return {
    titleId,
    markersFieldId,
    customRoleFieldId,
    lineEditFieldId,
    isOpen,
    onClose,
    sourceText,
    mergeBrokenLines,
    setMergeBrokenLines,
    wrapRoleLabels,
    setWrapRoleLabels,
    trimExtraSpaces,
    setTrimExtraSpaces,
    stripLabelDots,
    setStripLabelDots,
    cleanOcr,
    setCleanOcr,
    removeOcrNoise,
    setRemoveOcrNoise,
    formatCastList,
    setFormatCastList,
    protectTitlePage,
    setProtectTitlePage,
    useRoleMarkers,
    setUseRoleMarkers,
    useRoleAliases,
    setUseRoleAliases,
    splitIntoScenes,
    setSplitIntoScenes,
    roleEntries,
    aliasDrafts,
    customRoleDraft,
    setCustomRoleDraft,
    editingLineNo,
    lineEditDraft,
    setLineEditDraft,
    editingNameId,
    nameEditDraft,
    setNameEditDraft,
    enabledRoleCount,
    castListDetected,
    preview,
    displayPreviewText,
    displayWarnings,
    sceneChunks,
    hasSourceText,
    previewUnchanged,
    hasUnmatchedMarkers,
    splitBlocked,
    lineEditCount,
    previewWarningByLine,
    warningsSummary,
    canApply,
    applyDisabledTitle,
    refreshDetectedRoles,
    setAllRolesEnabled,
    toggleRoleEntry,
    handleAliasChange,
    handleAliasBlur,
    startNameEdit,
    cancelNameEdit,
    saveNameEdit,
    addCustomRole,
    openLineEdit,
    saveLineEdit,
    cancelLineEdit,
    handleApply,
  };
}

export type FormatPlayPreviewStats = FormatPlayTextResult["stats"];
export type { FormatWarning, RoleMarkerEntry };
