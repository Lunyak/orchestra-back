import { Button } from "@shared/core/button/Button";
import { FC } from "react";

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
    return (
        <div>
            <div className="script-track-insert">
                <select
                    className="script-track-select"
                    value={selectedTrackId ?? undefined}
                    onChange={(event) => onSelectedTrackIdChange(Number(event.target.value))}
                >
                    {playlistOptions.length === 0 && (
                        <option value="">Треки не найдены</option>
                    )}
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
                        const target = playlistOptions.find(
                            (item) => item.id === selectedTrackId,
                        );
                        if (!target) return;
                        onInsertText(`\n\n[${target.title}](track:${target.id})\n\n`);
                    }}
                    disabled={playlistOptions.length === 0}
                >
                    Вставить трек
                </Button>
            </div>
            <div className="script-light-panel">
                <div className="script-light-grid">
                    {lightChannels.map((value, index) => (
                        <label
                            key={`light-${index + 1}`}
                            className="script-light-cell"
                            data-selected={selectedLightSlot === index + 1}
                        >
                            <input
                                type="text"
                                inputMode="numeric"
                                className="script-light-input"
                                value={value}
                                onFocus={() => onSelectedLightSlotChange(index + 1)}
                                onChange={(event) => {
                                    const next = [...lightChannels];
                                    next[index] = event.target.value;
                                    onLightChannelsChange(next);
                                }}
                                placeholder={`${index + 1}`}
                            />
                        </label>
                    ))}
                </div>
                <div className="script-light-insert">
                    <Button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                            const slotNumber = Number(selectedLightSlot);
                            if (!Number.isFinite(slotNumber)) return;
                            const clamped = Math.max(1, Math.min(8, Math.trunc(slotNumber)));
                            onInsertText(`\n\nСВЕТ — канал {{light:${clamped}}}\n\n`);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                const slotNumber = Number(selectedLightSlot);
                                if (!Number.isFinite(slotNumber)) return;
                                const clamped = Math.max(1, Math.min(8, Math.trunc(slotNumber)));
                                onInsertText(`\n\nСВЕТ — канал {{light:${clamped}}}\n\n`);
                            }
                        }}
                    >
                        Вставить свет
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ControlsScript;