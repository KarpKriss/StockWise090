import React from "react";
import { useSession } from "../../core/session/AppSession";

function getOperationMeta(type) {
  const normalized = String(type || "").toLowerCase();

  if (["surplus", "nadwyżka", "nadwyzka"].includes(normalized)) {
    return { color: "#4CAF50", prefix: "+" };
  }

  if (["brak", "shortage"].includes(normalized)) {
    return { color: "#F44336", prefix: "-" };
  }

  if (normalized === "checked_empty" || normalized === "pusta_lokalizacja") {
    return { color: "#2E7D32", prefix: "" };
  }

  if (normalized === "problem") {
    return { color: "#FB8C00", prefix: "" };
  }

  return { color: "#1976D2", prefix: "" };
}

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
          const meta = getOperationMeta(op.type);
          const quantity = Number(op.quantity) || 0;
          const label = op.sku || op.reason || String(op.type || "operacja");

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
                {op.location} | {label}
              </span>

              <span
                style={{
                  color: meta.color,
                  fontWeight: 600,
                }}
              >
                {meta.prefix}
                {quantity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SessionOperationsList;
