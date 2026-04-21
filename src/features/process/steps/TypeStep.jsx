import React from "react";
import { useAppPreferences } from "../../../core/preferences/AppPreferences";

function TypeStep({ value, onChange, error, options = [] }) {
  const { language } = useAppPreferences();
  const copy = {
    pl: {
      title: "Wybierz typ operacji",
      shortage: "Brak",
      surplus: "Nadwyzka",
    },
    en: {
      title: "Choose operation type",
      shortage: "Shortage",
      surplus: "Surplus",
    },
    de: {
      title: "Operationstyp wahlen",
      shortage: "Fehlmenge",
      surplus: "Mehrmenge",
    },
  }[language];

  const fallbackOptions = [
    { value: "surplus", label: copy.surplus },
    { value: "brak", label: copy.shortage },
  ];
  const sourceOptions = options?.length ? options : fallbackOptions;
  const resolvedOptions = sourceOptions.map((option) => ({
    value: option.value,
    label: option.label,
    tone: option.value === "surplus" ? "surplus" : "shortage",
  }));

  return (
    <>
      <div className="screen-title">{copy.title}</div>

      <div className="choice-grid">
        {resolvedOptions.map((option) => (
          <button
            key={option.value}
            className={`choice-btn ${option.tone} ${value === option.value ? "active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            <div className="choice-label">{option.label}</div>
          </button>
        ))}
      </div>

      {error && <div className="input-error-text">{error}</div>}
    </>
  );
}

export default TypeStep;
