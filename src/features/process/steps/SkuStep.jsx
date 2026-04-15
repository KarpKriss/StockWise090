import React from "react";
import ScannableFieldStep from "./ScannableFieldStep";

function SkuStep({ value, onChange, error, scannerEnabled = false, onOpenScanner = null }) {
  return (
    <ScannableFieldStep
      title="Skanuj SKU"
      visual="SKU"
      value={value}
      onChange={onChange}
      error={error}
      placeholder="Wpisz SKU recznie"
      waitingLabel="Oczekiwanie na skan..."
      scannerEnabled={scannerEnabled}
      onOpenScanner={onOpenScanner}
    />
  );
}

export default SkuStep;
