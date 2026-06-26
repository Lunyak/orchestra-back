import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { orchestraApi } from "../api/rtk/orchestra-api";
import "../api/rtk/register-api";
import { playbookSlice } from "../../features/playbook/model/playbook-slice";
import { authSlice } from "../../features/auth/model/auth-slice";
import { showScriptSlice } from "../../features/show-script/model/show-script-slice";
import { showScriptMarkdownSlice } from "../../features/show-script-markdown/model/show-script-markdown-slice";
import { voiceTrainerUiSlice } from "../../features/actor-trainers/model/voiceTrainerUiSlice";
import { actorTrainerUiSlice } from "../../features/actor-trainers/model/actorTrainerUiSlice";
import { profileUiSlice } from "../../features/profile/model/profileUiSlice";
import { profileDataSlice } from "../../features/profile/model/profileDataSlice";
import { profileAvailabilitySlice } from "../../features/profile/model/profileAvailabilitySlice";
import { dictionTrainerUiSlice } from "../../features/trainers/model/dictionTrainerUiSlice";
import { speechTrainerUiSlice } from "../../features/trainers/model/speechTrainerUiSlice";
import { roleWorkbookSlice } from "../../features/role-workbook/model/roleWorkbookSlice";
import { scriptUiSlice } from "../../features/script-ui/model/script-ui-slice";

export const rootReducer = combineSlices(
  playbookSlice,
  authSlice,
  showScriptSlice,
  showScriptMarkdownSlice,
  scriptUiSlice,
  voiceTrainerUiSlice,
  actorTrainerUiSlice,
  profileUiSlice,
  profileDataSlice,
  profileAvailabilitySlice,
  dictionTrainerUiSlice,
  speechTrainerUiSlice,
  roleWorkbookSlice,
  orchestraApi,
);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(orchestraApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

