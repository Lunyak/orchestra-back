const { Markup } = require("telegraf");
const profileCallbacks = require("../handlers/callbacks/profileCallbacks");

module.exports = async (ctx, userStates, data) => {
  switch (data) {
    case "my_roles":
      return profileCallbacks.myRoles(ctx, userStates);
    case "back_to_profile":
      return profileCallbacks.backToProfile(ctx, userStates);
    case "add_role":
      return profileCallbacks.addRole(ctx, userStates);
    case "remove_role":
      return profileCallbacks.removeRole(ctx, userStates);
    case "profile_role":
      const editHandler = require("../handlers/editHandler");
      return editHandler(ctx, userStates);
    default:
      return null;
  }
};
