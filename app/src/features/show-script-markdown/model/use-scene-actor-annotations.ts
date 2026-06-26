import { useMemo } from "react";
import type { ActorAnnotationField } from "../../../sync/api/actor-notes";
import { useActorAnnotationsQuery } from "../../actor/api/actor-notes-api";

type UseSceneActorAnnotationsArgs = {
  projectSlug: string;
  sceneName: string;
  sceneId: number | null | undefined;
  field: ActorAnnotationField;
  enabled?: boolean;
};

export function useSceneActorAnnotations({
  projectSlug,
  sceneName,
  sceneId,
  field,
  enabled = true,
}: UseSceneActorAnnotationsArgs) {
  const skip = !enabled || sceneId == null;
  const queryArgs = {
    projectSlug,
    sceneName,
    sceneId: sceneId ?? 0,
    field,
  };

  const { data, isLoading, isFetching, error } = useActorAnnotationsQuery(queryArgs, { skip });

  const items = useMemo(() => {
    const list = data?.annotations ?? [];
    return list
      .slice()
      .sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);
  }, [data?.annotations]);

  const errorMessage = error ? "Не удалось загрузить метки" : null;

  return {
    items,
    loading: isLoading || isFetching,
    error: errorMessage,
  };
}
