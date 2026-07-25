import cn from "classnames";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "../../../shared/core/button/Button";
import { LabeledToggle } from "../../../shared/core/labeled-toggle/LabeledToggle";
import { Modal } from "../../../shared/core/modal/Modal";
import { applyPreviewLineEdits } from "../model/apply-preview-line-edits";
import {
  detectFormatWarnings,
  formatWarningsSummary,
} from "../model/detect-format-warnings";
import { detectRoleNamesForFormatting, formatPlayText, hasCastListSection } from "../model/formatPlayText";
import {
  createRoleMarkerEntry,
  entriesFromDetectedNames,
  formatAliasesInput,
  mergeDetectedRoleEntries,
  parseAliasesInput,
  renameRoleMarkerEntry,
  roleEntriesToMarkerSpecs,
  type RoleMarkerEntry,
} from "../model/role-marker-entries";
import {
  deriveSceneTitleFromChunk,
  splitPlayTextIntoChunks,
} from "../model/splitPlayTextIntoChunks";
import { FormatPlayMarkdownPreview } from "./FormatPlayMarkdownPreview";
import "./format-play-text-modal.css";

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

export function FormatPlayTextModal({
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

  const hasSourceText = sourceText.trim().length > 0;
  const previewUnchanged = displayPreviewText === sourceText;
  const hasUnmatchedMarkers =
    useRoleMarkers &&
    preview.stats.unmatchedMarkers.length > 0 &&
    preview.stats.inlineSplits === 0;
  const splitBlocked = splitIntoScenes && sceneChunks.length <= 1;
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
    (!previewUnchanged || preview.stats.inlineSplits > 0 || splitIntoScenes || Object.keys(lineEdits).length > 0) &&
    !hasUnmatchedMarkers &&
    !splitBlocked;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="format-play-text-modal"
      ariaLabelledBy={titleId}
    >
      <header className="format-play-text-modal__header">
        <h2 id={titleId} className="format-play-text-modal__title">
          Отформатировать текст пьесы
        </h2>
        <p className="format-play-text-modal__subtitle">
          Роли — из «Действующие лица». Псевдонимы — отдельным тоглом. Правка строк — в превью.
        </p>
      </header>

      <div className="format-play-text-modal__body">
      <details className="format-play-text-modal__settings">
        <summary className="format-play-text-modal__settings-summary">
          Настройки форматирования
        </summary>
        <div className="format-play-text-modal__options format-play-text-modal__options--compact">
          <LabeledToggle checked={cleanOcr} onChange={setCleanOcr}>
            Почистить OCR (склеить «З о т и к о в и ч»)
          </LabeledToggle>
          <LabeledToggle
            checked={removeOcrNoise}
            disabled={!cleanOcr}
            onChange={setRemoveOcrNoise}
          >
            Убрать служебные строки (FB2, OCR, библиография)
          </LabeledToggle>
          <LabeledToggle checked={formatCastList} onChange={setFormatCastList}>
            Форматировать «Действующие лица»
          </LabeledToggle>
          <LabeledToggle checked={protectTitlePage} onChange={setProtectTitlePage}>
            Не трогать титул (до списка персонажей / первого акта)
          </LabeledToggle>
          <LabeledToggle checked={mergeBrokenLines} onChange={setMergeBrokenLines}>
            Склеить разорванные строки
          </LabeledToggle>
          <LabeledToggle checked={wrapRoleLabels} onChange={setWrapRoleLabels}>
            Расставить лейблы в строке (ЕЛЕНА: …)
          </LabeledToggle>
        </div>
      </details>

      <div className="format-play-text-modal__markers">
        <div className="format-play-text-modal__markers-head">
          <LabeledToggle
            id={markersFieldId}
            checked={useRoleMarkers}
            onChange={setUseRoleMarkers}
          >
            Расставить роли в тексте
          </LabeledToggle>
          <LabeledToggle
            checked={useRoleAliases}
            disabled={!useRoleMarkers}
            onChange={setUseRoleAliases}
          >
            Псевдонимы
          </LabeledToggle>
        </div>
        <p className="format-play-text-modal__markers-hint">
          Список из блока <strong>«Действующие лица»</strong>. Включи «Псевдонимы», если в репликах
          короткие имена
        </p>
        {!castListDetected && hasSourceText ? (
          <p className="format-play-text-modal__markers-empty format-play-text-modal__markers-empty--warn">
            Блок «Действующие лица» не найден или пуст — включи «Форматировать „Действующие лица“»
            и проверь заголовок в тексте.
          </p>
        ) : null}

        <div className="format-play-text-modal__markers-toolbar">
          <button
            type="button"
            className="format-play-text-modal__markers-action"
            disabled={!useRoleMarkers || roleEntries.length === 0}
            onClick={() => setAllRolesEnabled(true)}
          >
            Выбрать все
          </button>
          <button
            type="button"
            className="format-play-text-modal__markers-action"
            disabled={!useRoleMarkers || roleEntries.length === 0}
            onClick={() => setAllRolesEnabled(false)}
          >
            Убрать все
          </button>
          <button
            type="button"
            className="format-play-text-modal__markers-action"
            disabled={!hasSourceText}
            onClick={refreshDetectedRoles}
          >
            Обновить из «Действующие лица»
          </button>
          <span className="format-play-text-modal__markers-count">
            {enabledRoleCount} из {roleEntries.length}
          </span>
        </div>

        {roleEntries.length > 0 ? (
          <div
            className={[
              "format-play-text-modal__markers-list",
              !useRoleMarkers ? "format-play-text-modal__markers-list--disabled" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {roleEntries.map((entry) => (
              <div
                key={entry.id}
                className={[
                  "format-play-text-modal__role-card",
                  useRoleAliases ? "" : "format-play-text-modal__role-card--no-aliases",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <LabeledToggle
                  className="format-play-text-modal__markers-item"
                  checked={entry.enabled}
                  disabled={!useRoleMarkers}
                  onChange={(checked) => toggleRoleEntry(entry.id, checked)}
                >
                  {editingNameId === entry.id ? (
                    <input
                      type="text"
                      className="format-play-text-modal__role-name-input native-text-input"
                      value={nameEditDraft}
                      disabled={!useRoleMarkers}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setNameEditDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveNameEdit();
                        }
                        if (event.key === "Escape") {
                          setEditingNameId(null);
                          setNameEditDraft("");
                        }
                      }}
                      onBlur={saveNameEdit}
                    />
                  ) : (
                    <button
                      type="button"
                      className="format-play-text-modal__markers-name format-play-text-modal__markers-name--btn"
                      disabled={!useRoleMarkers}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        startNameEdit(entry);
                      }}
                    >
                      {entry.name}
                    </button>
                  )}
                  {entry.isCustom ? (
                    <span className="format-play-text-modal__markers-tag">своё</span>
                  ) : null}
                </LabeledToggle>
                {useRoleAliases ? (
                  <input
                    type="text"
                    className="format-play-text-modal__role-aliases native-text-input"
                    value={aliasDrafts[entry.id] ?? formatAliasesInput(entry.aliases)}
                    disabled={!useRoleMarkers}
                    placeholder="псевдонимы: Ремонтный, Гусь"
                    onChange={(event) => handleAliasChange(entry.id, event.target.value)}
                    onBlur={handleAliasBlur}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="format-play-text-modal__markers-empty">
            {castListDetected
              ? "Роли не распознаны — проверь строки под «Действующие лица» или добавь вручную."
              : "Нет списка персонажей — добавь заголовок «Действующие лица» в текст или роли вручную."}
          </p>
        )}

        <div className="format-play-text-modal__markers-add">
          <label className="visually-hidden" htmlFor={customRoleFieldId}>
            Добавить роль
          </label>
          <input
            id={customRoleFieldId}
            type="text"
            className="format-play-text-modal__markers-add-input native-text-input"
            value={customRoleDraft}
            disabled={!useRoleMarkers}
            placeholder="Своя роль, например: Старый патриций"
            onChange={(event) => setCustomRoleDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addCustomRole();
            }}
          />
          <Button
            variant="secondary"
            disabled={!useRoleMarkers || !customRoleDraft.trim()}
            onClick={addCustomRole}
          >
            Добавить
          </Button>
        </div>
      </div>

      <div className="format-play-text-modal__split format-play-text-modal__split--compact">
        <LabeledToggle checked={splitIntoScenes} onChange={setSplitIntoScenes}>
          Разбить на сцены по актам, сценам и картинам
        </LabeledToggle>
        {splitIntoScenes ? (
          <p className="format-play-text-modal__split-hint">
            {sceneChunks.length > 1
              ? `Получится сцен: ${sceneChunks.length}. Границы — строки «Акт», «Сцена», «Картина», «Действие».`
              : "В тексте нет таких заголовков — добавь «Акт I», «Сцена 1», «Картина 2» и т.п."}
          </p>
        ) : null}
      </div>

      <div className="format-play-text-modal__preview">
        <div className="format-play-text-modal__pane">
          <div className="format-play-text-modal__pane-title">Было</div>
          <pre className="format-play-text-modal__text">{sourceText || "—"}</pre>
        </div>
        <div className="format-play-text-modal__pane">
          <div className="format-play-text-modal__pane-title">Станет · чтение</div>
          {displayWarnings.length > 0 ? (
            <div className="format-play-text-modal__warn-lines" role="list">
              {displayWarnings.map((warning) => {
                const isEditing = editingLineNo === warning.line;
                return (
                  <button
                    key={`${warning.line}-${warning.message}`}
                    type="button"
                    role="listitem"
                    className={cn(
                      "format-play-text-modal__warn-line",
                      isEditing && "format-play-text-modal__warn-line--editing",
                    )}
                    title={previewWarningByLine.get(warning.line)}
                    onClick={() => {
                      const line =
                        displayPreviewText.split("\n")[warning.line - 1] ?? "";
                      openLineEdit(warning.line, line);
                    }}
                  >
                    стр. {warning.line}: {warning.message}
                  </button>
                );
              })}
            </div>
          ) : null}
          <FormatPlayMarkdownPreview markdown={displayPreviewText} />
        </div>
      </div>

      {editingLineNo !== null ? (
        <div className="format-play-text-modal__line-edit">
          <label className="format-play-text-modal__line-edit-label" htmlFor={lineEditFieldId}>
            Правка строки {editingLineNo}
          </label>
          <textarea
            id={lineEditFieldId}
            className="format-play-text-modal__line-edit-input native-text-input"
            value={lineEditDraft}
            rows={3}
            onChange={(event) => setLineEditDraft(event.target.value)}
          />
          <div className="format-play-text-modal__line-edit-actions">
            <Button variant="secondary" onClick={saveLineEdit}>
              Сохранить строку
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditingLineNo(null);
                setLineEditDraft("");
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={[
          "format-play-text-modal__meta",
          hasUnmatchedMarkers || displayWarnings.length > 0
            ? "format-play-text-modal__meta--warn"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {hasUnmatchedMarkers ? (
          <>
            Не найдено в тексте:{" "}
            {preview.stats.unmatchedMarkers.map((marker) => `«${marker}»`).join(", ")}.
          </>
        ) : displayWarnings.length > 0 ? (
          <>Проверь строки: {warningsSummary}. Кликни предупреждение над превью «Станет».</>
        ) : preview.stats.inlineSplits > 0 ||
          preview.stats.mergedLines > 0 ||
          preview.stats.labeledLines > 0 ||
          preview.stats.propagatedLines > 0 ||
          preview.stats.matchedMarkers > 0 ||
          preview.stats.ocrLinesFixed > 0 ||
          preview.stats.castLinesFormatted > 0 ||
          Object.keys(lineEdits).length > 0 ? (
          <>
            {Object.keys(lineEdits).length > 0
              ? `Строк исправлено вручную: ${Object.keys(lineEdits).length}. `
              : null}
            {preview.stats.ocrLinesFixed > 0
              ? `OCR-строк исправлено: ${preview.stats.ocrLinesFixed}. `
              : null}
            {preview.stats.noiseLinesRemoved > 0
              ? `Служебных строк убрано: ${preview.stats.noiseLinesRemoved}. `
              : null}
            {preview.stats.castLinesFormatted > 0
              ? `Персонажей в списке: ${preview.stats.castRolesFound}. `
              : null}
            {preview.stats.castSplitLines > 0
              ? `Строк списка разбито: ${preview.stats.castSplitLines}. `
              : null}
            {preview.stats.inlineSplits > 0
              ? `Реплик разобрано: ${preview.stats.inlineSplits}. `
              : null}
            {preview.stats.matchedMarkers > 0
              ? `Меток на строках: ${preview.stats.matchedMarkers}. `
              : null}
            {preview.stats.mergedLines > 0
              ? `Склеено строк: ${preview.stats.mergedLines}. `
              : null}
            {preview.stats.labeledLines > 0
              ? `Лейблов в строке: ${preview.stats.labeledLines}. `
              : null}
            {preview.stats.propagatedLines > 0
              ? `Реплик по меткам: ${preview.stats.propagatedLines}.`
              : null}
          </>
        ) : useRoleMarkers && enabledRoleCount > 0 ? (
          `Выбрано ролей: ${enabledRoleCount}. Смотри колонку «Станет».`
        ) : splitBlocked ? (
          "Для нарезки нужны заголовки «Акт», «Сцена» или «Картина» в тексте."
        ) : splitIntoScenes && sceneChunks.length > 1 ? (
          `Будет создано сцен: ${sceneChunks.length}.`
        ) : previewUnchanged ? (
          "Изменений нет."
        ) : (
          "Можно применить."
        )}
      </div>
      </div>

      <footer className="format-play-text-modal__actions">
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button
          variant="primary"
          disabled={!canApply}
          title={
            hasUnmatchedMarkers
              ? "Сначала исправьте роли — их нет в тексте"
              : splitBlocked
                ? "Добавьте в текст «Акт», «Сцена» или «Картина» для нарезки"
                : undefined
          }
          onClick={() => {
            handleAliasBlur();
            const applySpecs = roleEntriesToMarkerSpecs(resolveRoleEntriesForApply());
            const formattedText = formatPlayText(sourceText, {
              mergeBrokenLines,
              wrapRoleLabels,
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
          }}
        >
          Применить
        </Button>
      </footer>
    </Modal>
  );
}
