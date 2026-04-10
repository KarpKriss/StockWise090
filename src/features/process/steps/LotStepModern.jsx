import { Hash } from "lucide-react";

export default function LotStepModern({ value, onChange, error }) {
  return (
    <div className="process-section-card">
      <div className="scan-panel">
        <div className="scan-panel__header">
          <div className="scan-visual">
            <Hash size={20} />
          </div>
          <span>Numer LOT</span>
        </div>

        <input
          className={`input ${error ? "input-error" : ""}`}
          placeholder="Wprowadz numer partii"
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        />

        {error ? <div className="input-error-text">{error}</div> : null}
      </div>
    </div>
  );
}
