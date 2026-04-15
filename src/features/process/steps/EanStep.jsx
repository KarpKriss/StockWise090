import React from "react";
import ScannableFieldStep from "./ScannableFieldStep";

function EanStep({ value, onChange, error, scannerEnabled = false, onOpenScanner = null }) {
  return (
    <ScannableFieldStep
      title="Skanuj EAN"
      visual="EAN"
      value={value}
      onChange={onChange}
      error={error}
      placeholder="Wpisz EAN recznie"
      waitingLabel="Oczekiwanie na skan EAN..."
      scannerEnabled={scannerEnabled}
      onOpenScanner={onOpenScanner}
    />
  );
}

export default EanStep;
