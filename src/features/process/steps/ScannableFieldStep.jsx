import { Camera } from "lucide-react";
import React from "react";

function ScannableFieldStep({
  title,
  visual = null,
  value,
  onChange,
  error,
  placeholder,
  waitingLabel,
  scannerEnabled = false,
  onOpenScanner = null,
  helperText = "",
}) {
  return (
    <div className="scan-panel">
      <div className="scan-panel__header">
        {visual ? <div className="scan-visual">{visual}</div> : null}
        <span>{title}</span>
      </div>

      {waitingLabel ? <div className="scan-placeholder">{value || waitingLabel}</div> : null}

      <div className="scan-panel__field-row">
        <input
          className={`input ${error ? "input-error" : ""}`}
          placeholder={placeholder}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        />

        {scannerEnabled ? (
          <button
            type="button"
            className="app-icon-button"
            onClick={onOpenScanner}
            aria-label={`Otworz skaner dla pola ${title}`}
            style={{ minWidth: 46, alignSelf: "stretch" }}
          >
            <Camera size={18} />
          </button>
        ) : null}
      </div>

      {helperText ? <div className="helper-note" style={{ marginTop: 10 }}>{helperText}</div> : null}
      {error ? <div className="input-error-text">{error}</div> : null}
    </div>
  );
}

export default ScannableFieldStep;
