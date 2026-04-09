import React from "react";
import { useSession } from "../../core/session/AppSession";
import { useAuth } from "../../core/auth/AppAuth";

function SessionSummary() {
  const { session, startSession } = useSession();
  const { logout } = useAuth();

  if (!session) return null;

  const operations = session.operations || [];

  const totalOperations = operations.length;

  const uniqueSkus = new Set(operations.map((op) => op.sku)).size;

  const uniqueLocations = new Set(operations.map((op) => op.location)).size;

  const algebraicSum = operations.reduce((acc, op) => {
    const qty = Number(op.quantity) || 0;

    if (op.type === "nadwyżka") return acc + qty;
    if (op.type === "brak") return acc - qty;

    return acc;
  }, 0);

  return (
    <>
      <div className="screen-title">Podsumowanie sesji</div>

      <div className="confirm-card">
        <div className="confirm-row">
          <span>Ilość operacji</span>
          <span>{totalOperations}</span>
        </div>

        <div className="confirm-row">
          <span>Unikalne SKU</span>
          <span>{uniqueSkus}</span>
        </div>

        <div className="confirm-row">
          <span>Lokalizacje</span>
          <span>{uniqueLocations}</span>
        </div>

        <div className="confirm-row">
          <span>Suma algebraiczna</span>
          <span>{algebraicSum}</span>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <button className="btn-primary full" onClick={startSession}>
          Nowa sesja
        </button>

        <button
          className="btn-secondary full"
          style={{ marginTop: 12 }}
          onClick={logout}
        >
          Wyloguj
        </button>
      </div>
    </>
  );
}

export default SessionSummary;
