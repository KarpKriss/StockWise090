import React from "react";

function LotStep({ value, onChange, error }) {
  return (
    <>
      <div className="screen-title">Numer LOT</div>

      <input
        className={`input ${error ? "input-error" : ""}`}
        placeholder="Wprowadź numer partii"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />

      {error && <div className="input-error-text">{error}</div>}
    </>
  );
}

export default LotStep;
