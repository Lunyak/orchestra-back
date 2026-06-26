import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  ActorAnnotation,
  ActorAnnotationField,
} from "../../../sync/api/actor-notes";

export type ActorAnnotationsArgs = {
  projectSlug: string;
  sceneName: string;
  sceneId: number;
  field: ActorAnnotationField;
};

export function actorAnnotationsTag(args: ActorAnnotationsArgs) {
  return {
    type: "ActorAnnotations" as const,
    id: `${args.projectSlug}:${args.sceneName}:${args.sceneId}:${args.field}`,
  };
}

export const actorNotesApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    actorAnnotations: build.query<{ annotations: ActorAnnotation[] }, ActorAnnotationsArgs>({
      query: (args) => ({
        url: "/actor-notes/annotations",
        params: args,
      }),
      providesTags: (_result, _error, args) => [actorAnnotationsTag(args)],
    }),

    createActorAnnotation: build.mutation<
      { annotation: ActorAnnotation },
      ActorAnnotationsArgs & {
        startOffset: number;
        endOffset: number;
        selectedText?: string;
        noteText: string;
      }
    >({
      query: (body) => ({
        url: "/actor-notes/annotations",
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_result, _error, body) => [actorAnnotationsTag(body)],
    }),

    updateActorAnnotation: build.mutation<
      { annotation: ActorAnnotation },
      { id: string; noteText: string; scope: ActorAnnotationsArgs }
    >({
      query: ({ id, noteText }) => ({
        url: `/actor-notes/annotations/${encodeURIComponent(id)}`,
        method: "PATCH",
        data: { noteText },
      }),
      invalidatesTags: (_result, _error, { scope }) => [actorAnnotationsTag(scope)],
    }),

    deleteActorAnnotation: build.mutation<
      { ok: boolean },
      { id: string; scope: ActorAnnotationsArgs }
    >({
      query: ({ id }) => ({
        url: `/actor-notes/annotations/${encodeURIComponent(id)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { scope }) => [actorAnnotationsTag(scope)],
    }),
  }),
});

export const {
  useActorAnnotationsQuery,
  useCreateActorAnnotationMutation,
  useUpdateActorAnnotationMutation,
  useDeleteActorAnnotationMutation,
} = actorNotesApi;
