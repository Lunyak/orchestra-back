import { useRef, useState } from "react";
import { getDesktopApi } from "../../../../../shared/platform/desktop-api";
import { desktopAddProjectImage } from "../../../../../shared/platform/desktop-methods";
import type {
  TheaterLayout,
  TheaterSurfaceMaterial,
  TheaterSurfaceTextureMode,
} from "../../../../../shared/types/script";
import {
  DECOR_TEXTURE_MODES,
  DECOR_TEXTURE_PRESETS,
  getDecorTexturePresetId,
  toDecorTextureFileRef,
  toDecorTexturePresetRef,
  type DecorTexturePresetId,
} from "../../../model/theater-decor-textures";
import {
  getTheaterSurfaceMaterialConfig,
  isTheaterSurfaceMaterialKey,
  normalizeTheaterSurfaceMaterial,
  THEATER_SURFACE_MATERIALS,
  type TheaterSurfaceMaterialKey,
} from "../../../model/theater-surface-materials";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function TheaterControlsLayoutMaterialsSection({ vm }: LayoutSectionProps) {
  const [surfaceKey, setSurfaceKey] =
    useState<TheaterSurfaceMaterialKey>("stageFloorMaterial");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const config = getTheaterSurfaceMaterialConfig(surfaceKey);
  const material = normalizeTheaterSurfaceMaterial(
    surfaceKey,
    vm.layout[surfaceKey],
  );
  const texturePresetId = getDecorTexturePresetId(material.texture);

  const updateSurfaceMaterial = (patch: Partial<TheaterSurfaceMaterial>) => {
    vm.updateLayout({
      [surfaceKey]: {
        ...material,
        ...patch,
      },
    } as Partial<TheaterLayout>);
  };

  const handleUploadTexture = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const api = getDesktopApi();
    let textureRef: string;

    if (api?.addProjectImage) {
      const buffer = await file.arrayBuffer();
      const result = await desktopAddProjectImage(
        api,
        vm.projectName,
        new Uint8Array(buffer),
        file.type,
        file.name,
      );
      if (!result?.ok || !result.file) {
        if (!result?.canceled) {
          console.error("Failed to add theater surface texture:", result?.error);
        }
        return;
      }
      textureRef = toDecorTextureFileRef(result.file);
    } else {
      textureRef = await readFileAsDataUrl(file);
    }

    updateSurfaceMaterial({
      texture: textureRef,
      textureMode: "once",
      textureRepeat: 1,
    });
  };

  return (
    <TheaterCollapsibleSection
      sectionId="layout-surface-materials"
      title="Материалы пола и стен"
      static
    >
      <div className="theater-layout-grid">
        <TheaterField label="Поверхность">
          <select
            className="native-text-input"
            value={surfaceKey}
            onChange={(event) => {
              const next = event.target.value;
              if (isTheaterSurfaceMaterialKey(next)) setSurfaceKey(next);
            }}
          >
            {THEATER_SURFACE_MATERIALS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </TheaterField>
        <TheaterField label="Цвет">
          <input
            type="color"
            className="native-text-input"
            value={material.color ?? config.defaultColor}
            onChange={(event) => updateSurfaceMaterial({ color: event.target.value })}
          />
        </TheaterField>
      </div>
      <div className="theater-layout-grid">
        <TheaterField label="Пресет материала">
          <select
            className="native-text-input"
            value={texturePresetId ? toDecorTexturePresetRef(texturePresetId) : ""}
            onChange={(event) => {
              const next = event.target.value;
              updateSurfaceMaterial({
                texture: next || undefined,
                textureMode: next ? "cover" : "repeat",
              });
            }}
          >
            <option value="">Без пресета</option>
            {DECOR_TEXTURE_PRESETS.map((preset) => (
              <option
                key={preset.id}
                value={toDecorTexturePresetRef(preset.id as DecorTexturePresetId)}
              >
                {preset.label}
              </option>
            ))}
          </select>
        </TheaterField>
        <TheaterField label="Режим текстуры">
          <select
            className="native-text-input"
            value={material.textureMode ?? "repeat"}
            onChange={(event) =>
              updateSurfaceMaterial({
                textureMode: event.target.value as TheaterSurfaceTextureMode,
              })
            }
          >
            {DECOR_TEXTURE_MODES.map((mode) => (
              <option key={mode.id} value={mode.id} title={mode.title}>
                {mode.label}
              </option>
            ))}
          </select>
        </TheaterField>
      </div>
      <TheaterField label="Повтор / масштаб">
        <input
          type="number"
          className="native-text-input"
          min={0.05}
          max={8}
          step={0.05}
          value={material.textureRepeat ?? 1}
          onFocus={vm.beginTheaterHistoryTransaction}
          onBlur={vm.endTheaterHistoryTransaction}
          onChange={(event) =>
            updateSurfaceMaterial({
              textureRepeat: Math.min(8, Math.max(0.05, Number(event.target.value) || 1)),
            })
          }
        />
      </TheaterField>
      <div className="theater-btn-row theater-btn-row--3">
        <TheaterBtn onClick={() => fileInputRef.current?.click()}>
          Загрузить текстуру
        </TheaterBtn>
        <TheaterBtn
          disabled={!material.texture}
          onClick={() => updateSurfaceMaterial({ texture: undefined })}
        >
          Очистить текстуру
        </TheaterBtn>
        <TheaterBtn
          onClick={() =>
            updateSurfaceMaterial({
              color: config.defaultColor,
              texture: undefined,
              textureMode: "repeat",
              textureRepeat: 1,
            })
          }
        >
          Сбросить
        </TheaterBtn>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void handleUploadTexture(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </TheaterCollapsibleSection>
  );
}
