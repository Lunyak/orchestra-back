import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import { actorNotesApi } from "../../actor/api/actor-notes-api";

type CacheKey = string;

function getAccessToken(getState: () => RootState): string | null {
  const fromState = getState().auth?.accessToken ?? null;
  if (fromState) return fromState;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

type ActorNoteEntry = {
  text: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
};

export interface ShowScriptState {
  actorNotesByKey: Record<CacheKey, ActorNoteEntry | undefined>;
}

const initialState: ShowScriptState = {
  actorNotesByKey: {},
};

export const loadActorSceneNote = createAsyncThunk<
  { cacheKey: CacheKey; text: string },
  { cacheKey: CacheKey; projectSlug: string; sceneName: string; sceneId: number }
>("showScript/loadActorSceneNote", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) return { cacheKey: args.cacheKey, text: "" };
  const result = await api.dispatch(
    actorNotesApi.endpoints.actorSceneNote.initiate(
      {
        projectSlug: args.projectSlug,
        sceneName: args.sceneName,
        sceneId: args.sceneId,
      },
      { forceRefetch: true },
    ),
  );
  if (result.error) {
    throw result.error;
  }
  return { cacheKey: args.cacheKey, text: String(result.data?.note?.text ?? "") };
});

export const saveActorSceneNote = createAsyncThunk<
  { cacheKey: CacheKey; text: string },
  { cacheKey: CacheKey; projectSlug: string; sceneName: string; sceneId: number; text: string }
>("showScript/saveActorSceneNote", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) return { cacheKey: args.cacheKey, text: args.text };
  const result = await api.dispatch(
    actorNotesApi.endpoints.upsertActorSceneNote.initiate({
      projectSlug: args.projectSlug,
      sceneName: args.sceneName,
      sceneId: args.sceneId,
      text: args.text,
    }),
  );
  if (result.error) {
    throw result.error;
  }
  return { cacheKey: args.cacheKey, text: String(result.data?.note?.text ?? "") };
});

export const showScriptSlice = createSlice({
  name: "showScript",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(loadActorSceneNote.pending, (state, action) => {
      const { cacheKey } = action.meta.arg;
      const prev = state.actorNotesByKey[cacheKey];
      state.actorNotesByKey[cacheKey] = {
        text: prev?.text ?? "",
        loading: true,
        saving: false,
        error: null,
      };
    });
    builder.addCase(loadActorSceneNote.fulfilled, (state, action) => {
      state.actorNotesByKey[action.payload.cacheKey] = {
        text: action.payload.text,
        loading: false,
        saving: false,
        error: null,
      };
    });
    builder.addCase(loadActorSceneNote.rejected, (state, action) => {
      const { cacheKey } = action.meta.arg;
      const prev = state.actorNotesByKey[cacheKey];
      state.actorNotesByKey[cacheKey] = {
        text: prev?.text ?? "",
        loading: false,
        saving: false,
        error: "Не удалось загрузить заметку",
      };
    });

    builder.addCase(saveActorSceneNote.pending, (state, action) => {
      const { cacheKey } = action.meta.arg;
      const prev = state.actorNotesByKey[cacheKey];
      state.actorNotesByKey[cacheKey] = {
        text: prev?.text ?? action.meta.arg.text,
        loading: false,
        saving: true,
        error: null,
      };
    });
    builder.addCase(saveActorSceneNote.fulfilled, (state, action) => {
      state.actorNotesByKey[action.payload.cacheKey] = {
        text: action.payload.text,
        loading: false,
        saving: false,
        error: null,
      };
    });
    builder.addCase(saveActorSceneNote.rejected, (state, action) => {
      const { cacheKey } = action.meta.arg;
      const prev = state.actorNotesByKey[cacheKey];
      state.actorNotesByKey[cacheKey] = {
        text: prev?.text ?? action.meta.arg.text,
        loading: false,
        saving: false,
        error: "Не удалось сохранить заметку",
      };
    });
  },
});

export const showScriptReducer = showScriptSlice.reducer;
export const showScriptActions = showScriptSlice.actions;

export function selectActorNote(state: RootState, cacheKey: CacheKey): ActorNoteEntry {
  return (
    state.showScript.actorNotesByKey[cacheKey] ?? {
      text: "",
      loading: false,
      saving: false,
      error: null,
    }
  );
}
