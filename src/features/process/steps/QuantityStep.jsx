import React from "react";
import { useAppPreferences } from "../../../core/preferences/AppPreferences";

function QuantityStep({ value, onChange, error }) {
  const { language } = useAppPreferences();
  const copy = {
    pl: { title: "Wprowadz ilosc", deleteLabel: "Usun ostatnia cyfre" },
    en: { title: "Enter quantity", deleteLabel: "Remove last digit" },
    de: { title: "Menge eingeben", deleteLabel: "Letzte Ziffer loschen" },
  }[language];

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
      <div className="screen-title">{copy.title}</div>

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

        <button className="key-btn control" onClick={remove} aria-label={copy.deleteLabel}>
          <-
        </button>
      </div>

      {error && <div className="input-error-text">{error}</div>}
    </>
  );
}

export default QuantityStep;
