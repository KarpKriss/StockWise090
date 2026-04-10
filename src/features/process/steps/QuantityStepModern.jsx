import { Delete, Calculator } from "lucide-react";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function QuantityStepModern({ value, onChange, error }) {
  const append = (digit) => onChange(`${value || ""}${digit}`);
  const clear = () => onChange("");
  const remove = () => onChange((value || "").slice(0, -1));

  return (
    <div className="process-section-card">
      <div className="scan-panel">
        <div className="scan-panel__header">
          <div className="scan-visual">
            <Calculator size={20} />
          </div>
          <span>Wprowadz ilosc</span>
        </div>

        <div className="quantity-display">{value || "0"}</div>

        <div className="keypad">
          {DIGITS.map((digit) => (
            <button key={digit} type="button" className="key-btn" onClick={() => append(digit)}>
              {digit}
            </button>
          ))}

          <button type="button" className="key-btn control" onClick={clear}>
            C
          </button>

          <button type="button" className="key-btn zero" onClick={() => append("0")}>
            0
          </button>

          <button type="button" className="key-btn control" onClick={remove} aria-label="Usun">
            <Delete size={18} />
          </button>
        </div>

        {error ? <div className="input-error-text">{error}</div> : null}
      </div>
    </div>
  );
}
