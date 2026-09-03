import React, { useState } from "react";
import AccountLogin from "./AccountLogin";
import AccountAdminApp from "./AccountAdminApp";
import UserPortalRoot from "./UserPortalRoot";
import { loadAccountSession, clearAccountSession } from "./services/accountAuthApi";

export default function AccountPortalRoot() {
  const [session, setSession] = useState(() => loadAccountSession());

  const handleLogout = () => {
    clearAccountSession();
    setSession(null);
  };

  if (!session) {
    return <AccountLogin onLoggedIn={setSession} />;
  }

  if (session.role === "Account Admin") {
    return <AccountAdminApp session={session} onLogout={handleLogout} />;
  }

  return <UserPortalRoot session={session} onLogout={handleLogout} />;
}
