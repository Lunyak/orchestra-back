module.exports = {
  changeStep(iserID, userStates, stepName, ...rest) {
    const currentState = userStates?.get(iserID) || {};

    userStates.set(iserID, {
      ...currentState,
      step: stepName,
      ...rest,
    });
  },

  clearStep(iserID, userStates) {
    const currentState = userStates?.get(iserID) || {};

    userStates.set(iserID, {
      ...currentState,
      step: "",
    });
  },

  getRoleList(userID, userStates) {
    return userStates.get(userID)?.user?.characters || [];
  },
};
