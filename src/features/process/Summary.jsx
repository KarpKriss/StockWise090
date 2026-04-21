import React from "react";
import { useSession } from "../../core/session/AppSession";
import { useAuth } from "../../core/auth/AppAuth";
import { useAppPreferences } from "../../core/preferences/AppPreferences";

function isSurplusType(type) {
  return ["surplus", "nadwyzka", "nadwyzka"].includes(String(type || "").toLowerCase());
}

function isShortageType(type) {
  return ["brak", "shortage"].includes(String(type || "").toLowerCase());
}

function SessionSummary() {
  const { language } = useAppPreferences();
  const { session, startSession } = useSession();
  const { logout } = useAuth();
  const copy = {
    pl: {
      title: "Podsumowanie sesji",
      operations: "Ilosc operacji",
      uniqueSku: "Unikalne SKU",
      locations: "Lokalizacje",
      algebraicSum: "Suma algebraiczna",
      newSession: "Nowa sesja",
      logout: "Wyloguj",
    },
    en: {
      title: "Session summary",
      operations: "Operations count",
      uniqueSku: "Unique SKUs",
      locations: "Locations",
      algebraicSum: "Algebraic sum",
      newSession: "New session",
      logout: "Log out",
    },
    de: {
      title: "Sitzungszusammenfassung",
      operations: "Anzahl Operationen",
      uniqueSku: "Eindeutige SKU",
      locations: "Lokationen",
      algebraicSum: "Algebraische Summe",
      newSession: "Neue Sitzung",
      logout: "Abmelden",
    },
  }[language];

  if (!session) return null;

  const operations = session.operations || [];
  const totalOperations = operations.length;
  const uniqueSkus = new Set(operations.map((op) => op.sku).filter(Boolean)).size;
  const uniqueLocations = new Set(operations.map((op) => op.location).filter(Boolean)).size;
  const algebraicSum = operations.reduce((acc, op) => {
    const qty = Number(op.quantity) || 0;
    if (isSurplusType(op.type)) return acc + qty;
    if (isShortageType(op.type)) return acc - qty;
    return acc;
  }, 0);

  return (
    <>
      <div className="screen-title">{copy.title}</div>

      <div className="confirm-card">
        <div className="confirm-row">
          <span>{copy.operations}</span>
          <span>{totalOperations}</span>
        </div>

        <div className="confirm-row">
          <span>{copy.uniqueSku}</span>
          <span>{uniqueSkus}</span>
        </div>

        <div className="confirm-row">
          <span>{copy.locations}</span>
          <span>{uniqueLocations}</span>
        </div>

        <div className="confirm-row">
          <span>{copy.algebraicSum}</span>
          <span>{algebraicSum}</span>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <button className="btn-primary full" onClick={startSession}>
          {copy.newSession}
        </button>

        <button
          className="btn-secondary full"
          style={{ marginTop: 12 }}
          onClick={logout}
        >
          {copy.logout}
        </button>
      </div>
    </>
  );
}

export default SessionSummary;
