import { Button } from "@shared/core/button/Button";
import { FC, useEffect, useState } from "react";
import { useProject } from "../../../../features/project";
import { parseLightChannel } from "../utils/lightTokens";
import "./styles.css";

interface IProps {
    selectedTrackId: number | null;
    playlistOptions: { id: number; title: string }[];
    onSelectedTrackIdChange: (trackId: number | null) => void;
    lightChannels: string[];
    onLightChannelsChange: (next: string[]) => void;
    selectedLightSlot: number;
    onSelectedLightSlotChange: (slot: number) => void;
    onInsertText: (text: string) => void;
}

const ControlsScript: FC<IProps> = ({
    selectedTrackId,
    playlistOptions,
    onSelectedTrackIdChange,
    lightChannels,
    onLightChannelsChange,
    selectedLightSlot,
    onSelectedLightSlotChange,
    onInsertText,
}) => {
    const { projectName } = useProject();

    const toolsCollapseKey = `scriptEditorTools:collapsed:${projectName || "unknown"}`;
    const musicCollapseKey = `scriptEditorTools:music:collapsed:${projectName || "unknown"}`;
    const lightCollapseKey = `scriptEditorTools:light:collapsed:${projectName || "unknown"}`;

    const [toolsCollapsed, setToolsCollapsed] = useState<boolean>(() => {
        try {
            return (typeof window !== "undefined" ? localStorage.getItem(toolsCollapseKey) : null) === "1";
        } catch {
            return false;
        }
    });
    const [musicCollapsed, setMusicCollapsed] = useState<boolean>(() => {
        try {
            return (typeof window !== "undefined" ? localStorage.getItem(musicCollapseKey) : null) === "1";
        } catch {
            return false;
        }
    });
    const [lightCollapsed, setLightCollapsed] = useState<boolean>(() => {
        try {
            return (typeof window !== "undefined" ? localStorage.getItem(lightCollapseKey) : null) === "1";
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            if (typeof window === "undefined") return;
            localStorage.setItem(toolsCollapseKey, toolsCollapsed ? "1" : "0");
        } catch {
            // ignore
        }
    }, [toolsCollapseKey, toolsCollapsed]);

    useEffect(() => {
        try {
            if (typeof window === "undefined") return;
            localStorage.setItem(musicCollapseKey, musicCollapsed ? "1" : "0");
        } catch {
            // ignore
        }
    }, [musicCollapseKey, musicCollapsed]);

    useEffect(() => {
        try {
            if (typeof window === "undefined") return;
            localStorage.setItem(lightCollapseKey, lightCollapsed ? "1" : "0");
        } catch {
            // ignore
        }
    }, [lightCollapseKey, lightCollapsed]);

    return (
        <div className="script-editor-tools" data-collapsed={toolsCollapsed ? "true" : "false"}>
            <div className="script-editor-tools__header">
                <div className="script-editor-tools__title">Инструменты</div>
                <button
                    type="button"
                    className="script-editor-tools__toggle"
                    onClick={() => setToolsCollapsed((v) => !v)}
                    title={toolsCollapsed ? "Развернуть инструменты" : "Свернуть инструменты"}
                    aria-label={toolsCollapsed ? "Развернуть инструменты" : "Свернуть инструменты"}
                >
                    {toolsCollapsed ? "⟩" : "⟨"}
                </button>
            </div>

            <div className="script-editor-tools__sections" role="group" aria-label="Инструменты сценария">
                <section className="script-editor-tools__section" data-collapsed={musicCollapsed ? "true" : "false"}>
                    <button
                        type="button"
                        className="script-editor-tools__section-header"
                        onClick={() => setMusicCollapsed((v) => !v)}
                        aria-expanded={!musicCollapsed}
                        aria-controls="script-editor-tools__music"
                    >
                        <span>Звук / Музыка</span>
                        <span className="script-editor-tools__chevron">{musicCollapsed ? "⟩" : "⟨"}</span>
                    </button>
                    <div id="script-editor-tools__music" className="script-editor-tools__section-body">
                        <div className="script-track-insert">
                            <select
                                className="script-track-select"
                                value={selectedTrackId ?? ""}
                                onChange={(event) => {
                                    const raw = String(event.target.value ?? "").trim();
                                    if (!raw) {
                                        onSelectedTrackIdChange(null);
                                        return;
                                    }
                                    const n = Number(raw);
                                    onSelectedTrackIdChange(Number.isFinite(n) ? n : null);
                                }}
                            >
                                {playlistOptions.length === 0 && <option value="">Треки не найдены</option>}
                                {playlistOptions.map((track) => (
                                    <option key={track.id} value={track.id}>
                                        {track.title}
                                    </option>
                                ))}
                            </select>
                            <Button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => {
                                    const target = playlistOptions.find((item) => item.id === selectedTrackId);
                                    if (!target) return;
                                    onInsertText(`\n\n{{play:${target.id}}} [${target.title}](track:${target.id})\n\n`);
                                }}
                                disabled={playlistOptions.length === 0}
                            >
                                Вставить трек
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="script-editor-tools__section" data-collapsed={lightCollapsed ? "true" : "false"}>
                    <button
                        type="button"
                        className="script-editor-tools__section-header"
                        onClick={() => setLightCollapsed((v) => !v)}
                        aria-expanded={!lightCollapsed}
                        aria-controls="script-editor-tools__light"
                    >
                        <span>Свет</span>
                        <span className="script-editor-tools__chevron">{lightCollapsed ? "⟩" : "⟨"}</span>
                    </button>
                    <div id="script-editor-tools__light" className="script-editor-tools__section-body">
                        <div className="script-light-panel">
                            <div className="script-light-grid">
                                {lightChannels.map((value, index) => {
                                    const parsed = parseLightChannel(value);
                                    const hexColor = /^#[0-9a-f]{6}$/i.test(String(parsed.color ?? "").trim())
                                        ? String(parsed.color).trim()
                                        : "#2563eb";
                                    return (
                                        <label
                                            key={`light-${index + 1}`}
                                            className="script-light-cell"
                                            data-selected={selectedLightSlot === index + 1}
                                        >
                                            <input
                                                type="text"
                                                className="script-light-input"
                                                value={parsed.label}
                                                onFocus={() => onSelectedLightSlotChange(index + 1)}
                                                onChange={(event) => {
                                                    const next = [...lightChannels];
                                                    const nextLabel = event.target.value;
                                                    const colorPart = parsed.color ? `|${parsed.color}` : "";
                                                    next[index] = `${nextLabel}${colorPart}`;
                                                    onLightChannelsChange(next);
                                                }}
                                                placeholder={`Канал ${index + 1}`}
                                            />
                                            <input
                                                type="color"
                                                className="script-light-color"
                                                value={hexColor}
                                                onFocus={() => onSelectedLightSlotChange(index + 1)}
                                                onChange={(event) => {
                                                    const next = [...lightChannels];
                                                    const nextColor = event.target.value;
                                                    const nextLabel = parsed.label ?? "";
                                                    next[index] = `${nextLabel}|${nextColor}`;
                                                    onLightChannelsChange(next);
                                                }}
                                                title="Цвет канала"
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="script-light-insert">
                                <Button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        const slotNumber = Number(selectedLightSlot);
                                        if (!Number.isFinite(slotNumber)) return;
                                        const clamped = Math.max(1, Math.min(8, Math.trunc(slotNumber)));
                                        onInsertText(`\n\n{{light:${clamped}|СВЕТ}} — канал ${clamped}\n\n`);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            const slotNumber = Number(selectedLightSlot);
                                            if (!Number.isFinite(slotNumber)) return;
                                            const clamped = Math.max(1, Math.min(8, Math.trunc(slotNumber)));
                                            onInsertText(`\n\n{{light:${clamped}|СВЕТ}} — канал ${clamped}\n\n`);
                                        }
                                    }}
                                >
                                    Вставить свет
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ControlsScript;