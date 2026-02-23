import { combineSlices, configureStore, type ReducersMapObject } from "@reduxjs/toolkit";
import { sceneSlice } from "../../features/scene/model/scene-slice";
import { authSlice } from "../../features/auth/model/auth-slice";
import { showScriptSlice } from "../../features/show-script/model/show-script-slice";

const legacyReducers: ReducersMapObject = {};

export const rootReducer = combineSlices(legacyReducers, sceneSlice, authSlice, showScriptSlice);

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

