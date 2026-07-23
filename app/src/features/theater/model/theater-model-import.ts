import { encodeOrchestraModelRef } from "../../../shared/project-assets/orchestraModelRef";
import { ensureProject } from "../../../sync/api/projects";
import { uploadProjectFile } from "../../../sync/api/files";
import {
  modelDisplayNameFromFileName,
  readTheaterAccessToken,
  THEATER_MODEL_FILE_ACCEPT,
} from "./theater-model-helpers";

export function openTheaterModelWebUploadPicker(args: {
  projectName: string;
  onUploaded: (fileRef: string, displayName: string) => void;
  onAuthRequired: () => void;
  onError: () => void;
}) {
  const token = readTheaterAccessToken();
  if (!token) {
    args.onAuthRequired();
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = THEATER_MODEL_FILE_ACCEPT;
  input.multiple = false;
  input.onchange = () => {
    const file = input.files?.[0] ?? null;
    if (!file) return;
    void (async () => {
      try {
        const project = await ensureProject(
          token,
          args.projectName,
          `Проект ${args.projectName}`,
        );
        const { key } = await uploadProjectFile(token, {
          projectId: project.id,
          type: "model",
          file,
        });
        args.onUploaded(
          encodeOrchestraModelRef(key),
          modelDisplayNameFromFileName(file.name),
        );
      } catch (err) {
        console.error("Failed to upload model:", err);
        args.onError();
      }
    })();
  };
  input.click();
}
