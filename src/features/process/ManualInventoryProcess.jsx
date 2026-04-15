import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardList, PauseCircle, ScanSearch, ShieldAlert, Warehouse } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/layout/PageShell";
import BarcodeScannerModal from "../../components/scanner/BarcodeScannerModal";
import Button from "../../components/ui/Button";
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
import {
  DEFAULT_MANUAL_PROCESS_CONFIG,
  SCANNABLE_MANUAL_FIELDS,
  getOrderedEnabledManualSteps,
} from "../../core/config/manualProcessConfig";

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

function SummaryCard({ location, zone, savedCount, sessionZone }) {
  const rows = [
    ["Lokalizacja", location?.code || "-"],
    ["Strefa", location?.zone || zone || sessionZone || "-"],
    ["Operacje w lokalizacji", String(savedCount || 0)],
  ];

  return (
    <div className="app-card process-sidebar-card">
      <div className="process-sidebar-card__header">
        <div className="process-sidebar-card__icon">
          <Warehouse size={18} />
        </div>
        <div>
          <h3 className="process-sidebar-card__title">Biezaca lokalizacja</h3>
          <p className="process-panel__subtitle">Podglad aktywnego miejsca pracy i licznika zapisow.</p>
        </div>
      </div>

      <div className="process-sidebar-card__list">
        {rows.map(([label, value]) => (
          <div className="process-sidebar-card__row" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
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
  const [sessionZone, setSessionZone] = useState("");
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
  const [scannerModal, setScannerModal] = useState({
    open: false,
    fieldKey: null,
    title: "",
  });
  const locationStartedAtRef = useRef(null);
  const lockedLocationIdRef = useRef(null);

  const validationConfig = config?.validation || {};
  const stepConfig = config?.steps || {};
  const orderedSteps = useMemo(() => getOrderedEnabledManualSteps(config || { steps: {} }), [config]);
  const enabledOperationTypes = useMemo(() => {
    const types = config?.operationTypes || {};
    return Object.values(types).filter((item) => item?.enabled);
  }, [config]);
  const scanningConfig = config?.scanning || DEFAULT_MANUAL_PROCESS_CONFIG.scanning;
  const quantityWarningThreshold = validationConfig.quantityWarningThreshold || 999;

  const summaryRows = useMemo(
    () =>
      [
        stepConfig.location?.enabled !== false ? ["Lokalizacja", currentLocation?.code || "-"] : null,
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

  const processStageLabel = useMemo(() => {
    switch (stage) {
      case "location":
        return "Skan lokalizacji";
      case "details":
        return "Uzupelnianie operacji";
      case "summary":
        return "Podsumowanie";
      case "saved":
        return "Zapis zakonczony";
      case "problem":
        return "Raport problemu";
      default:
        return "Proces reczny";
    }
  }, [stage]);

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
          setConfig(DEFAULT_MANUAL_PROCESS_CONFIG);
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

  function getScanFieldConfig(fieldKey) {
    return scanningConfig.fields?.[fieldKey] || DEFAULT_MANUAL_PROCESS_CONFIG.scanning.fields[fieldKey];
  }

  function isScannerEnabledForField(fieldKey) {
    if (!scanningConfig.enabled) {
      return false;
    }

    if (!SCANNABLE_MANUAL_FIELDS.includes(fieldKey)) {
      return false;
    }

    return Boolean(getScanFieldConfig(fieldKey)?.enabled);
  }

  function openScanner(fieldKey, title) {
    if (!isScannerEnabledForField(fieldKey)) {
      return;
    }

    setScannerModal({
      open: true,
      fieldKey,
      title,
    });
  }

  function closeScanner() {
    setScannerModal({
      open: false,
      fieldKey: null,
      title: "",
    });
  }

  function handleScannerDetected(value) {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue || !scannerModal.fieldKey) {
      return;
    }

    if (scannerModal.fieldKey === "location") {
      setLocationInput(normalizedValue);
      setError("");
      return;
    }

    setField(scannerModal.fieldKey, normalizedValue);
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
        expectedZone: sessionZone || null,
        currentUserId: user.id,
        retries: Number(validationConfig.fetchRetries || 2),
      });

      const resolvedZone = sessionZone || location.zone || "";

      if (lockedLocationIdRef.current && lockedLocationIdRef.current !== location.id) {
        await releaseManualLocation({ locationId: lockedLocationIdRef.current });
        lockedLocationIdRef.current = null;
      }

      if (String(location.status || "").toLowerCase() !== "in_progress" || location.locked_by !== user.id) {
        await lockManualLocation({
          locationId: location.id,
          userId: user.id,
        });
      }

      lockedLocationIdRef.current = location.id;
      locationStartedAtRef.current = Date.now();
      setCurrentLocation(location);
      setSessionZone(resolvedZone);
      setCurrentZone(resolvedZone);
      setLocationInput(location.code || "");
      setLocationStock(await fetchLocationStockSnapshot(location.id, Number(validationConfig.fetchRetries || 2)));
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

    if (Number(validationConfig.quantityHardLimit || 0) > 0 && normalizedQuantity > Number(validationConfig.quantityHardLimit)) {
      throw new Error(validationConfig.quantityHardLimitMessage || "Ilosc przekracza dopuszczalny limit");
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
        setBufferMessage("Brak polaczenia lub timeout API. Operacja trafila do lokalnego bufora.");
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
            scannerEnabled={isScannerEnabledForField("ean")}
            onOpenScanner={() => openScanner("ean", "Skanuj EAN")}
          />
        );
      case "sku":
        return (
          <SkuStep
            key={step.key}
            value={form.sku}
            onChange={(value) => setField("sku", value)}
            error=""
            scannerEnabled={isScannerEnabledForField("sku")}
            onOpenScanner={() => openScanner("sku", "Skanuj SKU")}
          />
        );
      case "lot":
        return (
          <LotStep
            key={step.key}
            value={form.lot}
            onChange={(value) => setField("lot", value)}
            error=""
            scannerEnabled={isScannerEnabledForField("lot")}
            onOpenScanner={() => openScanner("lot", "Skanuj numer LOT")}
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
      setCurrentZone(sessionZone || "");
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
      setCurrentZone(sessionZone || "");
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
      setCurrentZone(sessionZone || "");
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
      setCurrentZone(sessionZone || "");
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
    setSessionZone("");
    setCurrentZone("");
    navigate("/menu");
  }

  async function handlePauseSession() {
    await handleAbandonLocation();
    await pauseSession();
    setSessionZone("");
    setCurrentZone("");
    navigate("/menu");
  }

  if (!session?.session_id || !isActive) {
    return <div className="screen-title">Brak aktywnej sesji</div>;
  }

  if (loading || !config) {
    return <div className="screen-title">Ladowanie procesu recznego...</div>;
  }

  return (
    <PageShell
      title="Reczna inwentaryzacja"
      subtitle="Na telefonie proces zostaje prosty i pionowy, a na desktopie zamienia sie w spokojny panel roboczy z wyraznym kontekstem sesji obok."
      icon={<ScanSearch size={26} />}
      backTo="/process"
      backLabel="Powrot do wyboru procesu"
      actions={
        <div className="page-shell__pill">
          <ClipboardList size={14} />
          {processStageLabel}
        </div>
      }
    >
      <div className="process-layout process-layout--split">
        <div className="process-layout__main">
          {bufferMessage ? <div className="app-card process-inline-message">{bufferMessage}</div> : null}
          {timeWarning ? <div className="input-error-text">{timeWarning}</div> : null}
          {warnings.length > 0 ? (
            <div className="app-card process-inline-message process-inline-message--warning">
              {warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}
          {error ? <div className="input-error-text">{error}</div> : null}

          {stage === "location" ? (
            <div className="app-card process-stage-card process-stage-card--hero">
              <div className="process-stage-header">
                <div className="process-stage-header__icon">
                  <ScanSearch size={22} />
                </div>
                <div className="process-stage-header__text">
                  <h2>Wybierz lokalizacje startowa</h2>
                  <p>Zeskanuj lub wpisz lokalizacje, a potem przejdziemy do operacji w tej konkretnej pozycji.</p>
                </div>
              </div>

              <LocationStep
                value={locationInput}
                onChange={setLocationInput}
                error=""
                scannerEnabled={isScannerEnabledForField("location")}
                onOpenScanner={() => openScanner("location", "Skanuj lokalizacje")}
              />

              <div className="process-actions process-actions--tight">
                <Button size="lg" loading={submitting} onClick={handleLocationConfirm}>
                  Potwierdz lokalizacje
                </Button>
              </div>
            </div>
          ) : null}

          {stage === "details" ? (
            <div className="app-card process-stage-card">
              <div className="process-stage-header">
                <div className="process-stage-header__icon">
                  <ClipboardList size={22} />
                </div>
                <div className="process-stage-header__text">
                  <h2>Uzupelnij operacje dla lokalizacji</h2>
                  <p>Pracuj krok po kroku. Na desktopie pola sa skupione w panelu roboczym, bez rozciagania na caly ekran.</p>
                </div>
              </div>

              <div className="process-section-grid">
                {orderedSteps
                  .filter((step) => !["location", "confirmation"].includes(step.key))
                  .map(renderDetailStep)}
              </div>

              <div className="process-actions">
                <Button size="lg" loading={submitting} onClick={handleSummary}>
                  Podsumowanie
                </Button>
                <Button variant="secondary" size="lg" disabled={submitting} onClick={handleAbandonLocation}>
                  Zmien lokalizacje
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={submitting}
                  onClick={() => {
                    setError("");
                    setProblemNote("");
                    setStage("problem");
                  }}
                >
                  Zglos problem
                </Button>
              </div>
            </div>
          ) : null}

          {stage === "problem" && currentLocation ? (
            <div className="app-card process-stage-card">
              <div className="process-stage-header">
                <div className="process-stage-header__icon">
                  <ShieldAlert size={22} />
                </div>
                <div className="process-stage-header__text">
                  <h2>Zglos problem dla lokalizacji</h2>
                  <p>Zapisz problem i zostaw lokalizacje zablokowana do dalszej obslugi w panelu danych.</p>
                </div>
              </div>

              <div className="process-meta-grid">
                <div className="process-meta-item">
                  <div className="process-meta-item__label">Lokalizacja</div>
                  <div className="process-meta-item__value">{currentLocation.code}</div>
                </div>
                <div className="process-meta-item">
                  <div className="process-meta-item__label">Strefa</div>
                  <div className="process-meta-item__value">{currentLocation.zone || currentZone || "-"}</div>
                </div>
              </div>

              <textarea
                className="input"
                placeholder="Opcjonalny komentarz do problemu"
                value={problemNote}
                onChange={(event) => setProblemNote(event.target.value)}
                style={{ minHeight: 120 }}
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

              <div className="process-actions process-actions--tight">
                <Button variant="secondary" size="lg" disabled={submitting} onClick={() => setStage("details")}>
                  Wroc
                </Button>
              </div>
            </div>
          ) : null}

          {stage === "summary" ? (
            <div className="app-card process-stage-card">
              <div className="process-stage-header">
                <div className="process-stage-header__icon">
                  <ClipboardList size={22} />
                </div>
                <div className="process-stage-header__text">
                  <h2>Podsumowanie operacji</h2>
                  <p>Sprawdz wszystko jeszcze raz przed zapisem. Uklad zostaje zwarty i czytelny takze na szerokim ekranie.</p>
                </div>
              </div>

              <div className="confirm-card">
                {summaryRows.map(([label, value]) => (
                  <div className="confirm-row" key={label}>
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>

              <div className="process-actions">
                <Button size="lg" loading={submitting} onClick={handleSave}>
                  Zapisz operacje
                </Button>
                <Button variant="secondary" size="lg" disabled={submitting} onClick={() => setStage("details")}>
                  Wroc
                </Button>
              </div>
            </div>
          ) : null}

          {stage === "saved" ? (
            <div className="app-card process-stage-card">
              <div className="process-stage-header">
                <div className="process-stage-header__icon">
                  <ClipboardList size={22} />
                </div>
                <div className="process-stage-header__text">
                  <h2>Operacja zapisana</h2>
                  <p>Mozesz dodac kolejny wpis albo zamknac aktualna lokalizacje i przejsc dalej.</p>
                </div>
              </div>

              <div className="process-meta-grid">
                <div className="process-meta-item">
                  <div className="process-meta-item__label">Lokalizacja</div>
                  <div className="process-meta-item__value">{currentLocation?.code || "-"}</div>
                </div>
                <div className="process-meta-item">
                  <div className="process-meta-item__label">Zapisane operacje</div>
                  <div className="process-meta-item__value">{savedCountForLocation}</div>
                </div>
              </div>

              <div className="process-actions">
                <Button size="lg" disabled={submitting} onClick={() => setStage("details")}>
                  Dodaj kolejna operacje
                </Button>
                <Button variant="secondary" size="lg" disabled={submitting} onClick={handleFinishLocation}>
                  Zakoncz lokalizacje
                </Button>
                <Button variant="secondary" size="lg" disabled={submitting} onClick={handleAbandonLocation}>
                  Zwroc lokalizacje do puli
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="process-layout__aside">
          <div className="app-card process-sidebar-card process-sidebar-card--stage">
            <div className="process-sidebar-card__header">
              <div className="process-sidebar-card__icon">
                <ClipboardList size={18} />
              </div>
              <div>
                <h3 className="process-sidebar-card__title">Stan procesu</h3>
                <p className="process-panel__subtitle">Etap, kontekst sesji i aktualne priorytety operatora.</p>
              </div>
            </div>

            <div className="process-sidebar-stage">{processStageLabel}</div>
            <div className="process-sidebar-note">
              {stage === "location"
                ? "Na desktopie pole skanowania zostaje w centrum, bez zbednego rozciagania calego widoku."
                : currentLocation
                  ? `Pracujesz teraz na lokalizacji ${currentLocation.code}.`
                  : "Po wyborze lokalizacji tutaj zobaczysz jej kontekst."}
            </div>
          </div>

          {currentLocation ? (
            <SummaryCard
              location={currentLocation}
              zone={currentZone}
              sessionZone={sessionZone}
              savedCount={savedCountForLocation}
            />
          ) : null}

          {summaryRows.length > 0 && stage !== "summary" ? (
            <div className="app-card process-sidebar-card">
              <div className="process-sidebar-card__header">
                <div className="process-sidebar-card__icon">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h3 className="process-sidebar-card__title">Biezace dane</h3>
                  <p className="process-panel__subtitle">Szybki podglad tego, co operator wpisal do formularza.</p>
                </div>
              </div>

              <div className="process-sidebar-card__list">
                {summaryRows.map(([label, value]) => (
                  <div className="process-sidebar-card__row" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="app-card process-sidebar-card">
            <div className="process-sidebar-card__header">
              <div className="process-sidebar-card__icon">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="process-sidebar-card__title">Sterowanie sesja</h3>
                <p className="process-panel__subtitle">Najwazniejsze akcje sesji sa zawsze pod reka, ale nie rozpychaja glownego panelu.</p>
              </div>
            </div>

            <div className="process-actions process-actions--stack">
              <Button variant="secondary" size="lg" disabled={submitting} onClick={handlePauseSession}>
                <PauseCircle size={16} />
                Wstrzymaj prace
              </Button>
              <Button variant="secondary" size="lg" disabled={submitting} onClick={handleEndSession}>
                Zakoncz sesje
              </Button>
              <Button variant="secondary" size="lg" disabled={submitting} onClick={() => navigate("/menu")}>
                Powrot do menu
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <BarcodeScannerModal
        open={scannerModal.open}
        title={scannerModal.title}
        description="Zeskanuj kod aparatem telefonu albo wgraj zdjecie z aparatu. Po odczycie wartosc zostanie wpisana do pola procesu."
        formats={scannerModal.fieldKey ? getScanFieldConfig(scannerModal.fieldKey)?.formats || [] : []}
        preferBackCamera={Boolean(scanningConfig.preferBackCamera)}
        autoCloseOnSuccess={Boolean(scanningConfig.autoCloseOnSuccess)}
        onDetected={handleScannerDetected}
        onClose={closeScanner}
      />
    </PageShell>
  );
}
