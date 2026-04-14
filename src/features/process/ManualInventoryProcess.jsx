import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../core/auth/AppAuth";
import { useSession } from "../../core/session/AppSession";
import {
  completeManualLocation,
  fetchLocationStockSnapshot,
  fetchManualProcessConfig,
  flushBufferedManualEntries,
  lockManualLocation,
  releaseManualLocation,
  reportManualLocationProblem,
  resolveManualProduct,
  saveManualEntryWithResilience,
  validateManualLocation,
} from "../../core/api/manualProcessApi";
import LocationStep from "./steps/LocationStep";
import EanStep from "./steps/EanStep";
import SkuStep from "./steps/SkuStep";
import LotStep from "./steps/LotStep";
import ExpiryStep from "./steps/ExpiryStep";
import TypeStep from "./steps/TypeStep";
import QuantityStep from "./steps/QuantityStep";
import { getOrderedEnabledManualSteps } from "../../core/config/manualProcessConfig";

const PROBLEM_OPTIONS = [
  "Towar uszkodzony",
  "Problem z iloscia towaru",
  "Brak identyfikacji towaru",
];

const INITIAL_FORM = {
  ean: "",
  sku: "",
  lot: "",
  expiry: "",
  type: "",
  quantity: "",
};

function isValidIsoDate(value) {
  if (!value) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function ManualInventoryProcess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { session, isActive, addOperation, endSession, pauseSession } = useSession();
  const [config, setConfig] = useState(null);
  const [stage, setStage] = useState("location");
  const [locationInput, setLocationInput] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentZone, setCurrentZone] = useState("");
  const [locationStock, setLocationStock] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [bufferMessage, setBufferMessage] = useState("");
  const [timeWarning, setTimeWarning] = useState("");
  const [savedCountForLocation, setSavedCountForLocation] = useState(0);
  const [problemNote, setProblemNote] = useState("");
  const locationStartedAtRef = useRef(null);
  const lockedLocationIdRef = useRef(null);

  const validationConfig = config?.validation || {};
  const stepConfig = config?.steps || {};
  const orderedSteps = useMemo(() => getOrderedEnabledManualSteps(config || { steps: {} }), [config]);
  const enabledOperationTypes = useMemo(() => {
    const types = config?.operationTypes || {};
    return Object.values(types).filter((item) => item?.enabled);
  }, [config]);

  const quantityWarningThreshold =
    validationConfig.quantityWarningThreshold || 999;

  const summaryRows = useMemo(
    () =>
      [
        stepConfig.location?.enabled !== false
          ? ["Lokalizacja", currentLocation?.code || "-"]
          : null,
        currentLocation?.zone || currentZone ? ["Strefa", currentLocation?.zone || currentZone || "-"] : null,
        stepConfig.ean?.enabled ? ["EAN", form.ean || "-"] : null,
        stepConfig.sku?.enabled ? ["SKU", form.sku || "-"] : null,
        stepConfig.lot?.enabled ? ["LOT", form.lot || "-"] : null,
        stepConfig.expiry?.enabled ? ["Data waznosci", form.expiry || "-"] : null,
        stepConfig.type?.enabled ? ["Typ", form.type || "-"] : null,
        stepConfig.quantity?.enabled ? ["Ilosc", form.quantity || "-"] : null,
      ].filter(Boolean),
    [currentLocation?.code, currentLocation?.zone, currentZone, form, stepConfig]
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        setLoading(true);
        const [nextConfig, flushResult] = await Promise.all([
          fetchManualProcessConfig(user?.site_id),
          flushBufferedManualEntries(),
        ]);

        if (cancelled) {
          return;
        }

      setConfig(nextConfig);

        if (flushResult.sent > 0) {
          setBufferMessage(`Wyslano z bufora ${flushResult.sent} operacji.`);
        }
      } catch (initError) {
        if (!cancelled) {
          setError(initError.message || "Blad uruchamiania procesu recznego");
          setConfig({
            steps: {
              location: { label: "Lokalizacja", enabled: true, mandatory: true, order: 1 },
              ean: { label: "EAN", enabled: true, mandatory: false, order: 2 },
              sku: { label: "SKU", enabled: true, mandatory: true, order: 3 },
              lot: { label: "LOT", enabled: true, mandatory: false, order: 4 },
              expiry: { label: "Data waznosci", enabled: true, mandatory: false, order: 5 },
              type: { label: "Typ operacji", enabled: true, mandatory: true, order: 6 },
              quantity: { label: "Ilosc", enabled: true, mandatory: true, order: 7 },
              confirmation: { label: "Potwierdzenie", enabled: true, mandatory: false, order: 8 },
            },
            operationTypes: {
              shortage: { label: "Brak", value: "brak", enabled: true },
              surplus: { label: "Nadwyzka", value: "surplus", enabled: true },
            },
            validation: {
              lotPattern: "^[A-Za-z0-9._/-]{1,50}$",
              lotMessage: "Niepoprawny format LOT",
              quantityWarningThreshold: 999,
              quantityHardLimit: 999999,
              quantityHardLimitMessage: "Ilosc przekracza dopuszczalny limit",
              locationTimeoutMs: 5 * 60 * 1000,
              saveTimeoutMs: 10000,
              saveRetries: 2,
              fetchRetries: 2,
            },
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    const handleOnline = async () => {
      const flushResult = await flushBufferedManualEntries();

      if (flushResult.sent > 0) {
        setBufferMessage(`Przywrocono polaczenie. Wyslano ${flushResult.sent} operacji.`);
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, [user?.site_id]);

  useEffect(() => {
    return () => {
      if (lockedLocationIdRef.current) {
        releaseManualLocation({ locationId: lockedLocationIdRef.current }).catch((releaseError) => {
          console.error("MANUAL PROCESS CLEANUP RELEASE ERROR:", releaseError);
        });
      }
    };
  }, []);

  useEffect(() => {
    if (!currentLocation || !validationConfig.locationTimeoutMs) {
      setTimeWarning("");
      return undefined;
    }

    const interval = setInterval(() => {
      const startedAt = locationStartedAtRef.current;

      if (!startedAt) {
        return;
      }

      const elapsed = Date.now() - startedAt;

      if (elapsed > validationConfig.locationTimeoutMs) {
        setTimeWarning("Przekroczono limit czasu kontroli tej lokalizacji.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentLocation, validationConfig.locationTimeoutMs]);

  function setField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setError("");
    setWarnings([]);
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setWarnings([]);
    setError("");
  }

  async function handleLocationConfirm() {
    if (!user?.id) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setWarnings([]);

      const location = await validateManualLocation({
        code: locationInput,
        siteId: user?.site_id,
        expectedZone: currentZone || null,
        currentUserId: user.id,
      });

      if (lockedLocationIdRef.current && lockedLocationIdRef.current !== location.id) {
        await releaseManualLocation({ locationId: lockedLocationIdRef.current });
        lockedLocationIdRef.current = null;
      }

      if (
        String(location.status || "").toLowerCase() !== "in_progress" ||
        location.locked_by !== user.id
      ) {
        await lockManualLocation({
          locationId: location.id,
          userId: user.id,
        });
      }

      lockedLocationIdRef.current = location.id;
      locationStartedAtRef.current = Date.now();
      setCurrentLocation(location);
      setCurrentZone((current) => current || location.zone || "");
      setLocationInput(location.code || "");
      setLocationStock(await fetchLocationStockSnapshot(location.id));
      setSavedCountForLocation(0);
      setProblemNote("");
      resetForm();
      setStage("details");
    } catch (locationError) {
      setError(locationError.message || "Nie udalo sie pobrac lokalizacji");
    } finally {
      setSubmitting(false);
    }
  }

  async function validateOperation() {
    const nextWarnings = [];
    const normalizedQuantity = Number(form.quantity);

    if (!currentLocation?.code) {
      throw new Error("Brak aktywnej lokalizacji");
    }

    if (stepConfig.sku?.enabled && stepConfig.sku?.mandatory && !form.sku.trim()) {
      throw new Error("SKU jest wymagane");
    }

    if (stepConfig.ean?.enabled && stepConfig.ean?.mandatory && !form.ean.trim()) {
      throw new Error("EAN jest wymagany");
    }

    if (validationConfig.eanPattern && form.ean) {
      const eanRegex = new RegExp(validationConfig.eanPattern);
      if (!eanRegex.test(form.ean.trim())) {
        throw new Error(validationConfig.eanMessage || "Niepoprawny format EAN");
      }
    }

    if (validationConfig.skuPattern && form.sku) {
      const skuRegex = new RegExp(validationConfig.skuPattern);
      if (!skuRegex.test(form.sku.trim())) {
        throw new Error(validationConfig.skuMessage || "Niepoprawny format SKU");
      }
    }

    const product = await resolveManualProduct({
      sku: form.sku,
      ean: form.ean,
    });

    const lotRegex = new RegExp(validationConfig.lotPattern || "^[A-Za-z0-9._/-]{1,50}$");

    if (stepConfig.lot?.enabled && stepConfig.lot?.mandatory && !form.lot.trim()) {
      throw new Error("LOT jest wymagany");
    }

    if (form.lot && !lotRegex.test(form.lot.trim())) {
      throw new Error(validationConfig.lotMessage || "Niepoprawny format LOT");
    }

    if (stepConfig.expiry?.enabled && stepConfig.expiry?.mandatory && !form.expiry) {
      throw new Error("Data waznosci jest wymagana");
    }

    if (form.expiry && !isValidIsoDate(form.expiry)) {
      throw new Error("Niepoprawny format daty");
    }

    if (stepConfig.type?.enabled && stepConfig.type?.mandatory && !form.type) {
      throw new Error("Wybierz typ operacji");
    }

    if (stepConfig.quantity?.enabled && stepConfig.quantity?.mandatory && (!normalizedQuantity || normalizedQuantity <= 0)) {
      throw new Error("Ilosc musi byc wieksza od zera");
    }

    if (
      Number(validationConfig.quantityHardLimit || 0) > 0 &&
      normalizedQuantity > Number(validationConfig.quantityHardLimit)
    ) {
      throw new Error(
        validationConfig.quantityHardLimitMessage || "Ilosc przekracza dopuszczalny limit",
      );
    }

    if (normalizedQuantity > quantityWarningThreshold) {
      nextWarnings.push("Ilosc przekracza zalecany limit dla jednej operacji.");
    }

    const stockMatch = locationStock.find(
      (row) =>
        row.productId === product.id ||
        (row.sku && row.sku === product.sku) ||
        (row.ean && product.ean && row.ean === product.ean)
    );

    if (!stockMatch) {
      nextWarnings.push("SKU nie wystepuje w stocku tej lokalizacji.");
    }

    setWarnings(nextWarnings);

    return {
      product,
      quantity: normalizedQuantity,
    };
  }

  async function handleSummary() {
    try {
      setSubmitting(true);
      setError("");
      await validateOperation();
      setStage("summary");
    } catch (validationError) {
      setError(validationError.message || "Nie mozna przejsc dalej");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    if (!session?.session_id || !user?.id) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const { product, quantity } = await validateOperation();
      const payload = {
        session_id: session.session_id,
        operator: user.email,
        site_id: user.site_id,
        user_id: user.id,
        operation_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        location: currentLocation.code,
        ean: form.ean || product.ean || null,
        sku: product.sku,
        lot: form.lot || null,
        expiry: form.expiry || null,
        expiry_date: form.expiry || null,
        type: form.type,
        quantity,
      };

      const result = await saveManualEntryWithResilience(payload, config || {});

      addOperation(payload);
      setSavedCountForLocation((current) => current + 1);

      if (result.status === "buffered") {
        setBufferMessage(
          "Brak polaczenia lub timeout API. Operacja trafila do lokalnego bufora."
        );
      } else {
        setBufferMessage("");
      }

      resetForm();
      setStage("saved");
    } catch (saveError) {
      setError(saveError.message || "Nie udalo sie zapisac operacji");
    } finally {
      setSubmitting(false);
    }
  }

  function renderDetailStep(step) {
    switch (step.key) {
      case "ean":
        return (
          <EanStep
            key={step.key}
            value={form.ean}
            onChange={(value) => setField("ean", value)}
            error=""
          />
        );
      case "sku":
        return (
          <SkuStep
            key={step.key}
            value={form.sku}
            onChange={(value) => setField("sku", value)}
            error=""
          />
        );
      case "lot":
        return (
          <LotStep
            key={step.key}
            value={form.lot}
            onChange={(value) => setField("lot", value)}
            error=""
          />
        );
      case "expiry":
        return (
          <ExpiryStep
            key={step.key}
            value={form.expiry}
            onChange={(value) => setField("expiry", value)}
            error=""
          />
        );
      case "type":
        return (
          <TypeStep
            key={step.key}
            value={form.type}
            onChange={(value) => setField("type", value)}
            error=""
            options={enabledOperationTypes}
          />
        );
      case "quantity":
        return (
          <QuantityStep
            key={step.key}
            value={form.quantity}
            onChange={(value) => setField("quantity", value)}
            error=""
          />
        );
      default:
        return null;
    }
  }

  async function handleFinishLocation() {
    if (!currentLocation?.id || !session?.session_id || !user?.id) {
      return;
    }

    try {
      setSubmitting(true);
      await completeManualLocation({
        locationId: currentLocation.id,
        sessionId: session.session_id,
        userId: user.id,
        operatorEmail: user.email,
      });

      lockedLocationIdRef.current = null;
      locationStartedAtRef.current = null;
      setCurrentLocation(null);
      setCurrentZone("");
      setLocationStock([]);
      setLocationInput("");
      setSavedCountForLocation(0);
      setProblemNote("");
      setTimeWarning("");
      resetForm();
      setStage("location");
    } catch (finishError) {
      setError(finishError.message || "Nie udalo sie zakonczyc lokalizacji");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAbandonLocation() {
    if (!lockedLocationIdRef.current) {
      setCurrentLocation(null);
      setCurrentZone("");
      setLocationStock([]);
      setLocationInput("");
      setSavedCountForLocation(0);
      setProblemNote("");
      setTimeWarning("");
      resetForm();
      setStage("location");
      return;
    }

    try {
      setSubmitting(true);
      await releaseManualLocation({ locationId: lockedLocationIdRef.current });
      lockedLocationIdRef.current = null;
      locationStartedAtRef.current = null;
      setCurrentLocation(null);
      setCurrentZone("");
      setLocationStock([]);
      setLocationInput("");
      setSavedCountForLocation(0);
      setTimeWarning("");
      resetForm();
      setStage("location");
    } catch (releaseError) {
      setError(releaseError.message || "Nie udalo sie zwrocic lokalizacji do puli");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReportProblem(reason) {
    if (!currentLocation?.id) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await reportManualLocationProblem({
        location: currentLocation,
        user,
        sessionId: session?.session_id || null,
        zone: currentLocation.zone || currentZone || null,
        reason,
        note: problemNote.trim() || null,
      });

      lockedLocationIdRef.current = null;
      locationStartedAtRef.current = null;
      setCurrentLocation(null);
      setCurrentZone("");
      setLocationStock([]);
      setLocationInput("");
      setSavedCountForLocation(0);
      setProblemNote("");
      setTimeWarning("");
      resetForm();
      setStage("location");
      setBufferMessage("Problem zostal zapisany. Lokalizacja pozostaje zablokowana do czasu zwolnienia w panelu Problemy.");
    } catch (problemError) {
      setError(problemError.message || "Nie udalo sie zapisac problemu");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEndSession() {
    await handleAbandonLocation();
    await endSession();
    navigate("/menu");
  }

  async function handlePauseSession() {
    await handleAbandonLocation();
    await pauseSession();
    navigate("/menu");
  }

  if (!session?.session_id || !isActive) {
    return <div className="screen-title">Brak aktywnej sesji</div>;
  }

  if (loading || !config) {
    return <div className="screen-title">Ladowanie procesu recznego...</div>;
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="screen-title">Reczna inwentaryzacja</div>

      {currentLocation && (
        <div className="confirm-card" style={{ marginBottom: 20 }}>
          <div className="confirm-row">
            <span>Lokalizacja</span>
            <span>{currentLocation.code}</span>
          </div>
          <div className="confirm-row">
            <span>Strefa</span>
            <span>{currentLocation.zone || "-"}</span>
          </div>
          <div className="confirm-row">
            <span>Operacje w lokalizacji</span>
            <span>{savedCountForLocation}</span>
          </div>
        </div>
      )}

      {timeWarning && (
        <div className="input-error-text" style={{ marginBottom: 12 }}>
          {timeWarning}
        </div>
      )}

      {bufferMessage && (
        <div className="confirm-card" style={{ marginBottom: 12 }}>
          {bufferMessage}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="confirm-card" style={{ marginBottom: 12 }}>
          {warnings.map((warning) => (
            <div key={warning} style={{ marginBottom: 6 }}>
              {warning}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="input-error-text" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {stage === "location" && (
        <>
          <LocationStep
            value={locationInput}
            onChange={setLocationInput}
            error=""
          />

          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button className="btn-primary full" disabled={submitting} onClick={handleLocationConfirm}>
              Potwierdz lokalizacje
            </button>
          </div>
        </>
      )}

      {stage === "details" && (
        <>
          {orderedSteps
            .filter((step) => !["location", "confirmation"].includes(step.key))
            .map(renderDetailStep)}

          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button className="btn-primary full" disabled={submitting} onClick={handleSummary}>
              Podsumowanie
            </button>
            <button className="btn-secondary full" disabled={submitting} onClick={handleAbandonLocation}>
              Zmien lokalizacje
            </button>
          </div>

          <button
            className="btn-secondary full"
            style={{ marginTop: 12 }}
            disabled={submitting}
            onClick={() => {
              setError("");
              setProblemNote("");
              setStage("problem");
            }}
          >
            Zglos problem
          </button>
        </>
      )}

      {stage === "problem" && currentLocation ? (
        <>
          <div className="confirm-header">Zglos problem dla lokalizacji</div>
          <div className="confirm-card" style={{ marginBottom: 20 }}>
            <div className="confirm-row">
              <span>Lokalizacja</span>
              <span>{currentLocation.code}</span>
            </div>
            <div className="confirm-row">
              <span>Strefa</span>
              <span>{currentLocation.zone || currentZone || "-"}</span>
            </div>
          </div>

          <textarea
            className="input"
            placeholder="Opcjonalny komentarz do problemu"
            value={problemNote}
            onChange={(event) => setProblemNote(event.target.value)}
            style={{ minHeight: 120, marginBottom: 16 }}
          />

          <div className="process-choice-grid">
            {PROBLEM_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className="card selectable process-choice-card"
                disabled={submitting}
                onClick={() => handleReportProblem(option)}
              >
                <div className="process-choice-card__title">{option}</div>
                <div className="process-choice-card__desc">
                  Zapisz problem i zablokuj lokalizacje do czasu zwolnienia w panelu danych.
                </div>
              </button>
            ))}
          </div>

          <button
            className="btn-secondary full"
            style={{ marginTop: 12 }}
            disabled={submitting}
            onClick={() => setStage("details")}
          >
            Wroc
          </button>
        </>
      ) : null}

      {stage === "summary" && (
        <>
          <div className="confirm-header">Podsumowanie operacji</div>
          <div className="confirm-card" style={{ marginBottom: 20 }}>
            {summaryRows.map(([label, value]) => (
              <div className="confirm-row" key={label}>
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-primary full" disabled={submitting} onClick={handleSave}>
              Zapisz operacje
            </button>
            <button className="btn-secondary full" disabled={submitting} onClick={() => setStage("details")}>
              Wroc
            </button>
          </div>
        </>
      )}

      {stage === "saved" && (
        <>
          <div className="confirm-header">Operacja zapisana</div>
          <div className="confirm-card" style={{ marginBottom: 20 }}>
            <div className="confirm-row">
              <span>Lokalizacja</span>
              <span>{currentLocation?.code || "-"}</span>
            </div>
            <div className="confirm-row">
              <span>Zapisane operacje</span>
              <span>{savedCountForLocation}</span>
            </div>
          </div>

          <button className="btn-primary full" disabled={submitting} onClick={() => setStage("details")}>
            Dodaj kolejna operacje
          </button>
          <button
            className="btn-secondary full"
            style={{ marginTop: 12 }}
            disabled={submitting}
            onClick={handleFinishLocation}
          >
            Zakoncz lokalizacje
          </button>
          <button
            className="btn-secondary full"
            style={{ marginTop: 12 }}
            disabled={submitting}
            onClick={handleAbandonLocation}
          >
            Zwroc lokalizacje do puli
          </button>
        </>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
        <button className="btn-secondary full" disabled={submitting} onClick={handlePauseSession}>
          Wstrzymaj prace
        </button>
        <button className="btn-secondary full" disabled={submitting} onClick={handleEndSession}>
          Zakoncz sesje
        </button>
        <button className="btn-secondary full" disabled={submitting} onClick={() => navigate("/menu")}>
          Powrot do menu
        </button>
      </div>
    </div>
  );
}
