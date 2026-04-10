import React from "react";

function ExpiryStep({ value, onChange, error }) {
  return (
    <>
      <div className="screen-title">Data waznosci</div>

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
