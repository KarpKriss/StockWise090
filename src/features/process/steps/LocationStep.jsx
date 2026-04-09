import React from "react";

function LocationStep({ value, onChange, error }) {
  return (
    <>
      <div className="screen-title">Skanuj lokalizację</div>

      <div className="scan-visual">📍</div>

      <div className="scan-placeholder">
        {value || "Oczekiwanie na skan..."}
      </div>

      <input
        className={`input ${error ? "input-error" : ""}`}
        placeholder="Wpisz lokalizację ręcznie"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />

      {error && <div className="input-error-text">{error}</div>}
    </>
  );
}

export default LocationStep;
