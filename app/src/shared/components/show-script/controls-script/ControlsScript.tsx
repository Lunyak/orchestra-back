import { FC, ReactNode, useEffect, useState } from "react";
import { useProject } from "../../../../features/project";
import { parseLightChannel } from "../utils/lightTokens";
import "./styles.css";

type ScriptEditorLightControls = {
    lightChannels: string[];
    onLightChannelsChange: (next: string[]) => void;
    selectedLightSlot: number;
    onSelectedLightSlotChange: (slot: number) => void;
    onInsertText: (text: string) => void;
};

interface IProps {
    /** Блок каналов света; если null — секция «Свет» скрыта */
    light: ScriptEditorLightControls | null;
    /** Роли в сцене, реквизит и т.п. — над секцией света */
    children?: ReactNode;
}

const ControlsScript: FC<IProps> = ({ light, children }) => {
    const { projectName } = useProject();

    const toolsCollapseKey = `scriptEditorTools:collapsed:${projectName || "unknown"}`;
    const lightCollapseKey = `scriptEditorTools:light:collapsed:${projectName || "unknown"}`;

    const [toolsCollapsed, setToolsCollapsed] = useState<boolean>(() => {
        try {
            return (typeof window !== "undefined" ? localStorage.getItem(toolsCollapseKey) : null) === "1";
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
                {children ? <div className="script-editor-tools__prepend">{children}</div> : null}
                {light ? (
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
                                    {light.lightChannels.map((value, index) => {
                                        const parsed = parseLightChannel(value);
                                        const hexColor = /^#[0-9a-f]{6}$/i.test(String(parsed.color ?? "").trim())
                                            ? String(parsed.color).trim()
                                            : "var(--color-primary)";
                                        return (
                                            <label
                                                key={`light-${index + 1}`}
                                                className="script-light-cell"
                                                data-selected={light.selectedLightSlot === index + 1}
                                            >
                                                <input
                                                    type="text"
                                                    className="script-light-input"
                                                    value={parsed.label}
                                                    onFocus={() => light.onSelectedLightSlotChange(index + 1)}
                                                    onChange={(event) => {
                                                        const next = [...light.lightChannels];
                                                        const nextLabel = event.target.value;
                                                        const colorPart = parsed.color ? `|${parsed.color}` : "";
                                                        next[index] = `${nextLabel}${colorPart}`;
                                                        light.onLightChannelsChange(next);
                                                    }}
                                                    placeholder={`Канал ${index + 1}`}
                                                />
                                                <input
                                                    type="color"
                                                    className="script-light-color"
                                                    value={hexColor}
                                                    onFocus={() => light.onSelectedLightSlotChange(index + 1)}
                                                    onChange={(event) => {
                                                        const next = [...light.lightChannels];
                                                        const nextColor = event.target.value;
                                                        const nextLabel = parsed.label ?? "";
                                                        next[index] = `${nextLabel}|${nextColor}`;
                                                        light.onLightChannelsChange(next);
                                                    }}
                                                    title="Цвет канала"
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </section>
                ) : null}
            </div>
        </div>
    );
};

export default ControlsScript;
