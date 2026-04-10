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
  const { session, isActive, addOperation, endSession } = useSession();
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
  const locationStartedAtRef = useRef(null);
  const lockedLocationIdRef = useRef(null);

  const quantityWarningThreshold =
    config?.quantityWarningThreshold || 999;

  const summaryRows = useMemo(
    () => [
      ["Lokalizacja", currentLocation?.code || "-"],
      ["Strefa", currentLocation?.zone || currentZone || "-"],
      ["EAN", form.ean || "-"],
      ["SKU", form.sku || "-"],
      ["LOT", form.lot || "-"],
      ["Data waznosci", form.expiry || "-"],
      ["Typ", form.type || "-"],
      ["Ilosc", form.quantity || "-"],
    ],
    [currentLocation?.code, currentLocation?.zone, currentZone, form]
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
            lotPattern: "^[A-Za-z0-9._/-]{1,50}$",
            lotMessage: "Niepoprawny format LOT",
            quantityWarningThreshold: 999,
            locationTimeoutMs: 5 * 60 * 1000,
            saveTimeoutMs: 10000,
            saveRetries: 2,
            fetchRetries: 2,
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
    if (!currentLocation || !config?.locationTimeoutMs) {
      setTimeWarning("");
      return undefined;
    }

    const interval = setInterval(() => {
      const startedAt = locationStartedAtRef.current;

      if (!startedAt) {
        return;
      }

      const elapsed = Date.now() - startedAt;

      if (elapsed > config.locationTimeoutMs) {
        setTimeWarning("Przekroczono limit czasu kontroli tej lokalizacji.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentLocation, config?.locationTimeoutMs]);

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

    if (!form.sku.trim()) {
      throw new Error("SKU jest wymagane");
    }

    const product = await resolveManualProduct({
      sku: form.sku,
      ean: form.ean,
    });

    const lotRegex = new RegExp(config?.lotPattern || "^[A-Za-z0-9._/-]{1,50}$");

    if (form.lot && !lotRegex.test(form.lot.trim())) {
      throw new Error(config?.lotMessage || "Niepoprawny format LOT");
    }

    if (form.expiry && !isValidIsoDate(form.expiry)) {
      throw new Error("Niepoprawny format daty");
    }

    if (!form.type) {
      throw new Error("Wybierz typ operacji");
    }

    if (!normalizedQuantity || normalizedQuantity <= 0) {
      throw new Error("Ilosc musi byc wieksza od zera");
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

  async function handleEndSession() {
    await handleAbandonLocation();
    await endSession();
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
          <EanStep value={form.ean} onChange={(value) => setField("ean", value)} error="" />
          <SkuStep value={form.sku} onChange={(value) => setField("sku", value)} error="" />
          <LotStep value={form.lot} onChange={(value) => setField("lot", value)} error="" />
          <ExpiryStep
            value={form.expiry}
            onChange={(value) => setField("expiry", value)}
            error=""
          />
          <TypeStep
            value={form.type}
            onChange={(value) => setField("type", value)}
            error=""
          />
          <QuantityStep
            value={form.quantity}
            onChange={(value) => setField("quantity", value)}
            error=""
          />

          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button className="btn-primary full" disabled={submitting} onClick={handleSummary}>
              Podsumowanie
            </button>
            <button className="btn-secondary full" disabled={submitting} onClick={handleAbandonLocation}>
              Zmien lokalizacje
            </button>
          </div>
        </>
      )}

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
