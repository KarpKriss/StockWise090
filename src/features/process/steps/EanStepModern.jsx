import { Barcode } from "lucide-react";

export default function EanStepModern({ value, onChange, error }) {
  return (
    <div className="process-section-card">
      <div className="scan-panel">
        <div className="scan-panel__header">
          <div className="scan-visual">
            <Barcode size={20} />
          </div>
          <span>Skanuj EAN</span>
        </div>

        <div className="scan-placeholder">{value || "Oczekiwanie na skan EAN..."}</div>

        <input
          className={`input ${error ? "input-error" : ""}`}
          placeholder="Wpisz EAN recznie"
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        />

        {error ? <div className="input-error-text">{error}</div> : null}
      </div>
    </div>
  );
}
