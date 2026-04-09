import React from "react";

function TypeStep({ onChange, error }) {
  return (
    <>
      <div className="screen-title">Wybierz typ operacji</div>

      <div className="choice-grid">
        <button
          className="choice-btn surplus"
          onClick={() => onChange("nadwyżka")}
        >
          <div className="choice-label">Nadwyżka</div>
        </button>

        <button
          className="choice-btn shortage"
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
