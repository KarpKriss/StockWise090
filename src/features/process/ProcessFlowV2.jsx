import React from "react";
import { useNavigate } from "react-router-dom";
import { saveEntry } from "../../core/api/entriesApi";
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
  const { user } = useAuth();
  const { session, isActive, addOperation } = useSession();
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
    return <div className="screen-title">Brak aktywnej sesji</div>;
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
      alert(error.message || "Błąd zapisu operacji");
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
                ? "EAN nieznany - możesz wpisać SKU ręcznie"
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
        return <div className="screen-title">Błąd konfiguracji procesu</div>;
    }
  };

  return (
    <>
      {renderStep()}

      <div style={{ marginTop: 32, display: "flex", gap: 12 }}>
        {currentStep !== "location" && <button onClick={previousStep}>Wstecz</button>}
        {!isLastStep && <button onClick={nextStep}>Dalej</button>}
        {isLastStep && <button onClick={handleFinalSave}>Zapisz operację</button>}
        <button onClick={() => navigate("/menu")}>Powrót do menu</button>
      </div>

      {currentStep === "confirmation" && <SessionOperationsList />}
    </>
  );
}
