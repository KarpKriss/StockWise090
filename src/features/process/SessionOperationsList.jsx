import React from "react";
import { useSession } from "../../core/session/SessionContext";

function SessionOperationsList() {
  const { session } = useSession();

  if (!session || !session.operations || session.operations.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 40 }}>
      <div className="screen-title" style={{ fontSize: 18 }}>
        Operacje w tej sesji
      </div>

      <div className="confirm-card">
        {session.operations.map((op, index) => {
          const isSurplus = op.type === "nadwyżka";

          return (
            <div
              key={index}
              className="confirm-row"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                paddingBottom: 8,
                marginBottom: 8,
              }}
            >
              <span>
                {op.location} | {op.sku}
              </span>

              <span
                style={{
                  color: isSurplus ? "#4CAF50" : "#F44336",
                  fontWeight: 600,
                }}
              >
                {isSurplus ? "+" : "-"}
                {op.quantity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SessionOperationsList;
