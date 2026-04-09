import React from "react";

function QuantityStep({ value, onChange, error }) {
  const append = (digit) => {
    onChange((value || "") + digit);
  };

  const clear = () => {
    onChange("");
  };

  const remove = () => {
    onChange((value || "").slice(0, -1));
  };

  return (
    <>
      <div className="screen-title">Wprowadź ilość</div>

      <div className="quantity-display">{value || "0"}</div>

      <div className="keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} className="key-btn" onClick={() => append(String(n))}>
            {n}
          </button>
        ))}

        <button className="key-btn control" onClick={clear}>
          C
        </button>

        <button className="key-btn zero" onClick={() => append("0")}>
          0
        </button>

        <button className="key-btn control" onClick={remove}>
          ⌫
        </button>
      </div>

      {error && <div className="input-error-text">{error}</div>}
    </>
  );
}

export default QuantityStep;
