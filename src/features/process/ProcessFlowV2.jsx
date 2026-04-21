import React from "react";
import { useNavigate } from "react-router-dom";
import { saveEntry } from "../../core/api/entriesApi";
import { useAppPreferences } from "../../core/preferences/AppPreferences";
import { processConfig } from "../../core/config/processConfig";
import { productMap } from "../../core/config/productMap";
import { useAuth } from "../../core/auth/AppAuth";
import { useSession } from "../../core/session/AppSession";
import { useProcessFlow } from "../../core/hooks/useProcessFlow";
import LocationStep from "./steps/LocationStep";
import EanStep from "./steps/EanStep";
import SkuStep from "./steps/SkuStep";
import LotStep from "./steps/LotStep";
import TypeStep from "./steps/TypeStep";
import QuantityStep from "./steps/QuantityStep";
import ConfirmationStep from "./steps/ConfirmationStep";
import SessionOperationsList from "./SessionOperationsList";

export default function ProcessFlow() {
  const navigate = useNavigate();
  const { language } = useAppPreferences();
  const { user } = useAuth();
  const { session, isActive, addOperation } = useSession();
  const copy = {
    pl: {
      noSession: "Brak aktywnej sesji",
      saveError: "Blad zapisu operacji",
      unknownEan: "EAN nieznany - mozesz wpisac SKU recznie",
      configError: "Blad konfiguracji procesu",
      back: "Wstecz",
      next: "Dalej",
      save: "Zapisz operacje",
      backToMenu: "Powrot do menu",
    },
    en: {
      noSession: "No active session",
      saveError: "Could not save the operation",
      unknownEan: "Unknown EAN - you can enter the SKU manually",
      configError: "Process configuration error",
      back: "Back",
      next: "Next",
      save: "Save operation",
      backToMenu: "Back to menu",
    },
    de: {
      noSession: "Keine aktive Sitzung",
      saveError: "Operation konnte nicht gespeichert werden",
      unknownEan: "EAN unbekannt - du kannst die SKU manuell eingeben",
      configError: "Fehler in der Prozesskonfiguration",
      back: "Zuruck",
      next: "Weiter",
      save: "Operation speichern",
      backToMenu: "Zuruck zum Menu",
    },
  }[language];

  const {
    currentStep,
    nextStep,
    previousStep,
    processData,
    setField,
    errors,
    resetProcess,
    isLastStep,
  } = useProcessFlow({
    sessionActive: isActive,
    processConfig,
  });

  if (!session?.session_id || !isActive) {
    return <div className="screen-title">{copy.noSession}</div>;
  }

  const handleFinalSave = async () => {
    if (!user?.id || !isLastStep) return;

    try {
      const payload = {
        session_id: session.session_id,
        operator: user.email,
        site_id: user.site_id,
        operation_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...processData,
      };

      await saveEntry(payload);
      addOperation(payload);
      resetProcess();
    } catch (error) {
      console.error("PROCESS SAVE ERROR:", error);
      alert(error.message || copy.saveError);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case "location":
        return (
          <LocationStep
            value={processData.location}
            onChange={(value) => setField("location", value)}
            error={errors.location}
          />
        );
      case "ean":
        return (
          <EanStep
            value={processData.ean}
            onChange={(value) => {
              setField("ean", value);
              setField("sku", productMap[value]?.sku || processData.sku || "");
            }}
            error={
              processData.ean && !productMap[processData.ean]
                ? copy.unknownEan
                : errors.ean
            }
          />
        );
      case "sku":
        return (
          <SkuStep
            value={processData.sku}
            onChange={(value) => setField("sku", value)}
            error={errors.sku}
          />
        );
      case "lot":
        return (
          <LotStep
            value={processData.lot}
            onChange={(value) => setField("lot", value)}
            error={errors.lot}
          />
        );
      case "type":
        return (
          <TypeStep
            value={processData.type}
            onChange={(value) => setField("type", value)}
            error={errors.type}
          />
        );
      case "quantity":
        return (
          <QuantityStep
            value={processData.quantity}
            onChange={(value) => setField("quantity", value)}
            error={errors.quantity}
          />
        );
      case "confirmation":
        return <ConfirmationStep data={processData} />;
      default:
        return <div className="screen-title">{copy.configError}</div>;
    }
  };

  return (
    <>
      {renderStep()}

      <div style={{ marginTop: 32, display: "flex", gap: 12 }}>
        {currentStep !== "location" && <button onClick={previousStep}>{copy.back}</button>}
        {!isLastStep && <button onClick={nextStep}>{copy.next}</button>}
        {isLastStep && <button onClick={handleFinalSave}>{copy.save}</button>}
        <button onClick={() => navigate("/menu")}>{copy.backToMenu}</button>
      </div>

      {currentStep === "confirmation" && <SessionOperationsList />}
    </>
  );
}
