import React from "react";

function TypeStep({ value, onChange, error }) {
  return (
    <>
      <div className="screen-title">Wybierz typ operacji</div>

      <div className="choice-grid">
        <button
          className={`choice-btn surplus ${value === "surplus" ? "active" : ""}`}
          onClick={() => onChange("surplus")}
        >
          <div className="choice-label">Nadwyzka</div>
        </button>

        <button
          className={`choice-btn shortage ${value === "brak" ? "active" : ""}`}
          onClick={() => onChange("brak")}
        >
          <div className="choice-label">Brak</div>
        </button>
      </div>

      {error && <div className="input-error-text">{error}</div>}
    </>
  );
}

export default TypeStep;
