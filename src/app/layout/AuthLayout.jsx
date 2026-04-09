import React from "react";

function AuthLayout({ children }) {
  return (
    <div className="login-background">
      <div className="glass-card">{children}</div>
    </div>
  );
}

export default AuthLayout;
