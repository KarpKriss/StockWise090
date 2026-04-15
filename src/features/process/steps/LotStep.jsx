import React from "react";
import ScannableFieldStep from "./ScannableFieldStep";

function LotStep({ value, onChange, error, scannerEnabled = false, onOpenScanner = null }) {
  return (
    <ScannableFieldStep
      title="Numer LOT"
      visual={null}
      value={value}
      onChange={onChange}
      error={error}
      placeholder="Wprowadz numer partii"
      scannerEnabled={scannerEnabled}
      onOpenScanner={onOpenScanner}
      helperText="Mozesz wpisac LOT recznie albo zeskanowac go aparatem, jesli to pole ma wlaczone skanowanie."
    />
  );
}

export default LotStep;
