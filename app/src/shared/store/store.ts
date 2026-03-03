import { combineSlices, configureStore, type ReducersMapObject } from "@reduxjs/toolkit";
import { sceneSlice } from "../../features/scene/model/scene-slice";
import { authSlice } from "../../features/auth/model/auth-slice";
import { showScriptSlice } from "../../features/show-script/model/show-script-slice";
import { showScriptMarkdownSlice } from "../../features/show-script-markdown/model/show-script-markdown-slice";
import { voiceTrainerUiSlice } from "../../features/actor-trainers/model/voiceTrainerUiSlice";
import { actorTrainerUiSlice } from "../../features/actor-trainers/model/actorTrainerUiSlice";
import { troupeSlice } from "../../features/troupe/model/troupe-slice";
import { profileUiSlice } from "../../features/profile/model/profileUiSlice";
import { profileDataSlice } from "../../features/profile/model/profileDataSlice";
import { profileAvailabilitySlice } from "../../features/profile/model/profileAvailabilitySlice";
import { profileRolesSlice } from "../../features/profile/model/profileRolesSlice";
import { dictionTrainerUiSlice } from "../../features/trainers/model/dictionTrainerUiSlice";
import { speechTrainerUiSlice } from "../../features/trainers/model/speechTrainerUiSlice";
import { roleWorkbookSlice } from "../../features/role-workbook/model/roleWorkbookSlice";
import { scriptUiSlice } from "../../features/script-ui/model/script-ui-slice";

const legacyReducers: ReducersMapObject = {};

export const rootReducer = combineSlices(
  legacyReducers,
  sceneSlice,
  authSlice,
  showScriptSlice,
  showScriptMarkdownSlice,
  scriptUiSlice,
  voiceTrainerUiSlice,
  actorTrainerUiSlice,
  troupeSlice,
  profileUiSlice,
  profileDataSlice,
  profileAvailabilitySlice,
  profileRolesSlice,
  dictionTrainerUiSlice,
  speechTrainerUiSlice,
  roleWorkbookSlice,
);

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

