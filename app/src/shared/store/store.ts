import { combineSlices, configureStore, type ReducersMapObject } from "@reduxjs/toolkit";
import { sceneSlice } from "../../features/scene/model/scene-slice";
import { authSlice } from "../../features/auth/model/auth-slice";
import { showScriptSlice } from "../../features/show-script/model/show-script-slice";
import { showScriptMarkdownSlice } from "../../features/show-script-markdown/model/show-script-markdown-slice";
import { voiceTrainerUiSlice } from "../../features/actor-trainers/model/voiceTrainerUiSlice";
import { actorTrainerUiSlice } from "../../features/actor-trainers/model/actorTrainerUiSlice";
import { troupeSlice } from "../../features/troupe/model/troupe-slice";

const legacyReducers: ReducersMapObject = {};

export const rootReducer = combineSlices(
  legacyReducers,
  sceneSlice,
  authSlice,
  showScriptSlice,
  showScriptMarkdownSlice,
  voiceTrainerUiSlice,
  actorTrainerUiSlice,
  troupeSlice,
);

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

