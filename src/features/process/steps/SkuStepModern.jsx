import { Package2 } from "lucide-react";

export default function SkuStepModern({ value, onChange, error }) {
  return (
    <div className="process-section-card">
      <div className="scan-panel">
        <div className="scan-panel__header">
          <div className="scan-visual">
            <Package2 size={20} />
          </div>
          <span>Skanuj SKU</span>
        </div>

        <div className="scan-placeholder">{value || "Oczekiwanie na skan SKU..."}</div>

        <input
          className={`input ${error ? "input-error" : ""}`}
          placeholder="Wpisz SKU recznie"
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        />

        {error ? <div className="input-error-text">{error}</div> : null}
      </div>
    </div>
  );
}
