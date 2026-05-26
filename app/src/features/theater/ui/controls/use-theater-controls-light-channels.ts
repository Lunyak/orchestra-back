import { useProject } from "../../../project/model/project-context";
import { useAppSelector } from "../../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../../show-script-markdown/model/show-script-markdown-slice";

export function useTheaterControlsLightChannels() {
  const { projectName } = useProject();
  const { lightChannels, selectedLightSlot } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );
  return { lightChannels, selectedLightSlot };
}
