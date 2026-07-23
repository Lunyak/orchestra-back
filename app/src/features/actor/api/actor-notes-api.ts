import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  ActorAnnotation,
  ActorAnnotationField,
  ActorSceneNote,
} from "../../../sync/api/actor-notes";

export type ActorAnnotationsArgs = {
  projectSlug: string;
  sceneName: string;
  sceneId: number;
  field: ActorAnnotationField;
};

export type ActorSceneNoteArgs = {
  projectSlug: string;
  sceneName: string;
  sceneId: number;
};

export function actorAnnotationsTag(args: ActorAnnotationsArgs) {
  return {
    type: "ActorAnnotations" as const,
    id: `${args.projectSlug}:${args.sceneName}:${args.sceneId}:${args.field}`,
  };
}

export function actorSceneNoteTag(args: ActorSceneNoteArgs) {
  return {
    type: "ActorSceneNote" as const,
    id: `${args.projectSlug}:${args.sceneName}:${args.sceneId}`,
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

    actorSceneNote: build.query<{ note: ActorSceneNote | null }, ActorSceneNoteArgs>({
      query: (args) => ({
        url: "/actor-notes/scene",
        params: args,
      }),
      providesTags: (_result, _error, args) => [actorSceneNoteTag(args)],
    }),

    upsertActorSceneNote: build.mutation<
      { note: ActorSceneNote | null },
      ActorSceneNoteArgs & { text?: string }
    >({
      query: (body) => ({
        url: "/actor-notes/scene",
        method: "PUT",
        data: body,
      }),
      invalidatesTags: (_result, _error, body) => [actorSceneNoteTag(body)],
    }),

    deleteActorSceneNote: build.mutation<{ ok: boolean }, ActorSceneNoteArgs>({
      query: (args) => ({
        url: "/actor-notes/scene",
        method: "DELETE",
        params: args,
      }),
      invalidatesTags: (_result, _error, args) => [actorSceneNoteTag(args)],
    }),
  }),
});

export const {
  useActorAnnotationsQuery,
  useCreateActorAnnotationMutation,
  useUpdateActorAnnotationMutation,
  useDeleteActorAnnotationMutation,
  useActorSceneNoteQuery,
  useUpsertActorSceneNoteMutation,
  useDeleteActorSceneNoteMutation,
} = actorNotesApi;
