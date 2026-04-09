import React from "react";

function MainLayout({ children }) {
  return (
    <div className="login-background">
      <div className="glass-card">{children}</div>
    </div>
  );
}

export default MainLayout;
