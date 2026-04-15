import React from "react";
import ScannableFieldStep from "./ScannableFieldStep";

function LocationStep({ value, onChange, error, scannerEnabled = false, onOpenScanner = null }) {
  return (
    <ScannableFieldStep
      title="Skanuj lokalizacje"
      visual="L"
      value={value}
      onChange={onChange}
      error={error}
      placeholder="Wpisz lokalizacje recznie"
      waitingLabel="Oczekiwanie na skan..."
      scannerEnabled={scannerEnabled}
      onOpenScanner={onOpenScanner}
    />
  );
}

export default LocationStep;
