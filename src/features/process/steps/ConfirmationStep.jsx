import React from "react";
import { useAppPreferences } from "../../../core/preferences/AppPreferences";

function ConfirmationStep({ data }) {
  const { language } = useAppPreferences();
  const copy = {
    pl: { title: "Potwierdzenie operacji" },
    en: { title: "Operation confirmation" },
    de: { title: "Operationsbestatigung" },
  }[language];

  return (
    <>
      <div className="confirm-header">{copy.title}</div>

      <div className="confirm-card">
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </>
  );
}

export default ConfirmationStep;
