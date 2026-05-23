/**
 * Side-effect imports: регистрируют injectEndpoints на orchestraApi.
 * Подключать один раз из store.ts.
 */
import "../../../features/profile/api/profile-api";
import "../../../features/project/api/project-api";
import "../../../features/rehearsals/api/rehearsals-api";
import "../../../features/director-sessions/api/director-sessions-api";
import "../../../features/troupe/api/troupe-api";
import "./sync-api";
