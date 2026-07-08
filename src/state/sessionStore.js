function createSessionStore() {
  let session = null;

  return {
    setSession(nextSession) {
      session = nextSession ? { ...nextSession } : null;
    },
    getSession() {
      return session ? { ...session } : null;
    },
    clearSession() {
      session = null;
    },
    hasSession() {
      return Boolean(session);
    }
  };
}

module.exports = {
  createSessionStore
};

