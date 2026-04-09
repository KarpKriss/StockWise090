import React from "react";

function EanStep({ value, onChange, error }) {
  return (
    <>
      <div className="screen-title">Skanuj EAN</div>

      <div className="scan-visual">📊</div>

      <div className="scan-placeholder">
        {value || "Oczekiwanie na skan EAN..."}
      </div>

      <input
        className={`input ${error ? "input-error" : ""}`}
        placeholder="Wpisz EAN ręcznie"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />

      {error && <div className="input-error-text">{error}</div>}
    </>
  );
}

export default EanStep;
