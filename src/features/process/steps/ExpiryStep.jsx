import React from "react";
import { useAppPreferences } from "../../../core/preferences/AppPreferences";

function ExpiryStep({ value, onChange, error }) {
  const { language } = useAppPreferences();
  const copy = {
    pl: { title: "Data waznosci" },
    en: { title: "Expiry date" },
    de: { title: "Verfallsdatum" },
  }[language];

  return (
    <>
      <div className="screen-title">{copy.title}</div>

      <input
        className={`input ${error ? "input-error" : ""}`}
        type="date"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      />

      {error && <div className="input-error-text">{error}</div>}
    </>
  );
}

export default ExpiryStep;
