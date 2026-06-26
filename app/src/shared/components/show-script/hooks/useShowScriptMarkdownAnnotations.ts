import {
  useCreateActorAnnotationMutation,
  useDeleteActorAnnotationMutation,
  useUpdateActorAnnotationMutation,
} from "../../../../features/actor/api/actor-notes-api";
import type { ActorAnnotationField } from "../../../../sync/api/actor-notes";
import type { NewAnnotationDraft } from "../annotations/ActorAnnotationsPopover";

export function useShowScriptMarkdownAnnotations(args: {
  projectSlug: string;
  sceneName: string;
  sceneId: number | undefined;
  activeField: ActorAnnotationField;
}) {
  const { projectSlug, sceneName, sceneId, activeField } = args;
  const [createActorAnnotation] = useCreateActorAnnotationMutation();
  const [updateActorAnnotation] = useUpdateActorAnnotationMutation();
  const [deleteActorAnnotation] = useDeleteActorAnnotationMutation();

  const handleCreateAnnotation = async (draft: NewAnnotationDraft) => {
    if (sceneId == null) return;
    await createActorAnnotation({
      projectSlug,
      sceneName,
      sceneId,
      field: activeField,
      startOffset: draft.start,
      endOffset: draft.end,
      selectedText: draft.selectedText,
      noteText: draft.noteText,
    }).unwrap();
  };

  const handleUpdateAnnotation = async (id: string, noteText: string) => {
    if (sceneId == null) return;
    await updateActorAnnotation({
      id,
      noteText,
      scope: {
        projectSlug,
        sceneName,
        sceneId,
        field: activeField,
      },
    }).unwrap();
  };

  const handleDeleteAnnotation = async (id: string) => {
    if (sceneId == null) return;
    await deleteActorAnnotation({
      id,
      scope: {
        projectSlug,
        sceneName,
        sceneId,
        field: activeField,
      },
    }).unwrap();
  };

  return {
    handleCreateAnnotation,
    handleUpdateAnnotation,
    handleDeleteAnnotation,
  };
}
