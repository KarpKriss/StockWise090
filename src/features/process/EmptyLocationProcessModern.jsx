import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  PackagePlus,
  ScanLine,
  Warehouse,
} from "lucide-react";
import { useAuth } from "../../core/auth/AppAuth";
import { useSession } from "../../core/session/AppSession";
import {
  confirmEmptyLocation,
  fetchEmptyLocationsForZone,
  fetchEmptyLocationZones,
  fetchQuickStartAnchorLocation,
  markLocationOnWork,
  releaseLocationWork,
  resolveProductForSurplus,
  reportLocationProblem,
  reportLocationSurplus,
} from "../../core/api/emptyLocationsApi";
import PageShell from "../../components/layout/PageShell";
import LoadingOverlay from "../../components/loaders/LoadingOverlay";
import Button from "../../components/ui/Button";
import BarcodeScannerModal from "../../components/scanner/BarcodeScannerModal";
import EanStepModern from "./steps/EanStepModern";
import SkuStepModern from "./steps/SkuStepModern";
import LotStepModern from "./steps/LotStepModern";
import QuantityStepModern from "./steps/QuantityStepModern";
import { DEFAULT_MANUAL_PROCESS_CONFIG } from "../../core/config/manualProcessConfig";
import { fetchManualProcessConfig } from "../../core/api/manualProcessApi";

const PROBLEM_OPTIONS = [
  {
    value: "Towar uszkodzony",
    title: "Towar uszkodzony",
    description: "Zglos uszkodzenie produktu lub opakowania.",
  },
  {
    value: "Problem z iloscia towaru",
    title: "Problem z iloscia",
    description: "Towar jest obecny, ale ilosc budzi watpliwosci.",
  },
  {
    value: "Brak identyfikacji towaru",
    title: "Brak identyfikacji",
    description: "Nie da sie jednoznacznie rozpoznac produktu.",
  },
];

function SummaryCard({ zone, progress, location }) {
  return (
    <div className="process-summary-card">
      <div className="process-summary-item">
        <div className="process-summary-item__label">Strefa</div>
        <div className="process-summary-item__value">{zone || "-"}</div>
      </div>
      <div className="process-summary-item">
        <div className="process-summary-item__label">Postep</div>
        <div className="process-summary-item__value">{progress}</div>
      </div>
      <div className="process-summary-item">
        <div className="process-summary-item__label">Aktualna lokalizacja</div>
        <div className="process-summary-item__value">{location || "-"}</div>
      </div>
    </div>
  );
}

function reorderLocationsFromAnchor(locations, anchorCode) {
  if (!Array.isArray(locations) || locations.length === 0) {
    return {
      locations: [],
      directionLabel: "brak pozycji",
      startedFromExactMatch: false,
    };
  }

  const normalizedAnchor = String(anchorCode || "").trim().toLowerCase();
  const exactIndex = locations.findIndex(
    (row) => String(row.code || "").trim().toLowerCase() === normalizedAnchor
  );

  let pivotIndex = exactIndex;
  let startedFromExactMatch = exactIndex >= 0;

  if (pivotIndex < 0) {
    pivotIndex = locations.findIndex(
      (row) => String(row.code || "").trim().toLowerCase() > normalizedAnchor
    );

    if (pivotIndex < 0) {
      pivotIndex = locations.length - 1;
    }
  }

  const beforeCount = pivotIndex;
  const afterCount = locations.length - pivotIndex - 1;
  const preferForward = afterCount >= beforeCount;

  if (preferForward) {
    return {
      locations: [...locations.slice(pivotIndex), ...locations.slice(0, pivotIndex)],
      directionLabel: "w strone konca strefy",
      startedFromExactMatch,
    };
  }

  const beforeSide = locations.slice(0, pivotIndex + 1).reverse();
  const afterSide = locations.slice(pivotIndex + 1).reverse();

  return {
    locations: [...beforeSide, ...afterSide],
    directionLabel: "w strone poczatku strefy",
    startedFromExactMatch,
  };
}

export default function EmptyLocationProcessModern() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { user } = useAuth();
  const { session, isActive, addOperation, endSession } = useSession();
  const [zones, setZones] = useState([]);
  const [completedZones, setCompletedZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState("");
  const [queue, setQueue] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState("zones");
  const [scanValue, setScanValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [surplusData, setSurplusData] = useState({
    ean: "",
    sku: "",
    lot: "",
    quantity: "",
  });
  const [problemNote, setProblemNote] = useState("");
  const [decisionScanValue, setDecisionScanValue] = useState("");
  const [quickStartInfo, setQuickStartInfo] = useState(null);
  const [scannerConfig, setScannerConfig] = useState(DEFAULT_MANUAL_PROCESS_CONFIG.scanning);
  const [scannerModal, setScannerModal] = useState({
    open: false,
    fieldKey: null,
    title: "",
  });
  const lockedLocationIdRef = useRef(null);
  const quickStartAttemptedRef = useRef(false);
  const scanInputRef = useRef(null);
  const decisionInputRef = useRef(null);

  const currentLocation = queue[currentIndex] || null;
  const totalLocations = totalCount || queue.length;
  const availableZones = useMemo(
    () => zones.filter((zone) => !completedZones.includes(zone)),
    [zones, completedZones]
  );

  useEffect(() => {
    if (!user?.site_id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadZones() {
      try {
        setLoading(true);
        const [zonesResult, configResult] = await Promise.allSettled([
          fetchEmptyLocationZones({ siteId: user.site_id }),
          fetchManualProcessConfig(user.site_id),
        ]);

        if (zonesResult.status === "rejected") {
          throw zonesResult.reason;
        }

        if (!cancelled) {
          setZones(zonesResult.value);
          setScannerConfig(
            configResult.status === "fulfilled"
              ? configResult.value?.scanning || DEFAULT_MANUAL_PROCESS_CONFIG.scanning
              : DEFAULT_MANUAL_PROCESS_CONFIG.scanning
          );
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Blad pobierania stref");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadZones();

    return () => {
      cancelled = true;
    };
  }, [user?.site_id]);

  useEffect(() => {
    const quickStartCode = routerLocation.state?.quickStartCode;
    const quickStartMode = routerLocation.state?.quickStartMode;

    if (!quickStartMode || !quickStartCode || !user?.site_id || quickStartAttemptedRef.current) {
      return;
    }

    quickStartAttemptedRef.current = true;

    async function startFromAnchor() {
      try {
        setSubmitting(true);
        setError("");

        const anchorLocation = await fetchQuickStartAnchorLocation({
          code: quickStartCode,
          siteId: user.site_id,
        });

        const result = await fetchEmptyLocationsForZone({
          zone: anchorLocation.zone,
          siteId: user.site_id,
        });

        const reordered = reorderLocationsFromAnchor(result.locations || [], anchorLocation.code);

        setSelectedZone(anchorLocation.zone || "");
        setQueue(reordered.locations);
        setTotalCount(result.totalCount || reordered.locations.length);
        setCurrentIndex(0);
        setScanValue("");
        setProblemNote("");
        setStage(reordered.locations.length ? "scan" : "zone-finished");
        setQuickStartInfo({
          anchorCode: anchorLocation.code,
          zone: anchorLocation.zone,
          directionLabel: reordered.directionLabel,
          startedFromExactMatch: reordered.startedFromExactMatch,
        });

        if (reordered.locations.length > 0) {
          await activateLocation(reordered.locations[0]);
        }
      } catch (err) {
        setError(err.message || "Nie udalo sie uruchomic szybkiego startu.");
      } finally {
        setSubmitting(false);
      }
    }

    startFromAnchor();
  }, [routerLocation.state, user?.site_id]);

  useEffect(() => {
    return () => {
      if (lockedLocationIdRef.current) {
        releaseLocationWork({ locationId: lockedLocationIdRef.current }).catch((releaseError) => {
          console.error("EMPTY PROCESS CLEANUP RELEASE ERROR:", releaseError);
        });
      }
    };
  }, []);

  useEffect(() => {
    if (stage !== "scan") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select?.();
    }, 60);

    return () => window.clearTimeout(timeoutId);
  }, [stage, currentLocation?.id]);

  function getScanFieldConfig(fieldKey) {
    return scannerConfig.fields?.[fieldKey] || DEFAULT_MANUAL_PROCESS_CONFIG.scanning.fields[fieldKey];
  }

  function isScannerEnabledForField(fieldKey) {
    return Boolean(scannerConfig.enabled && getScanFieldConfig(fieldKey)?.enabled);
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
    setError("");
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

    switch (scannerModal.fieldKey) {
      case "location":
        setScanValue(normalizedValue);
        break;
      case "decision-location":
        setDecisionScanValue(normalizedValue);
        break;
      case "surplus-ean":
        setSurplusData((current) => ({ ...current, ean: normalizedValue }));
        break;
      case "surplus-sku":
        setSurplusData((current) => ({ ...current, sku: normalizedValue }));
        break;
      case "surplus-lot":
        setSurplusData((current) => ({ ...current, lot: normalizedValue }));
        break;
      default:
        break;
    }
  }

  useEffect(() => {
    if (stage !== "decision") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      decisionInputRef.current?.focus();
      decisionInputRef.current?.select?.();
    }, 60);

    return () => window.clearTimeout(timeoutId);
  }, [stage, currentLocation?.id]);

  async function activateLocation(location) {
    if (!location?.id || !user?.id) {
      return;
    }

    await markLocationOnWork({
      locationId: location.id,
      userId: user.id,
    });

    lockedLocationIdRef.current = location.id;
  }

  async function beginZone(zone) {
    try {
      setSubmitting(true);
      const result = await fetchEmptyLocationsForZone({
        zone,
        siteId: user?.site_id,
      });
      const locations = result.locations || [];

      setSelectedZone(zone);
      setQueue(locations);
      setTotalCount(result.totalCount || locations.length);
      setCurrentIndex(0);
      setQuickStartInfo(null);
      setScanValue("");
      setDecisionScanValue("");
      setProblemNote("");
      setError("");

      if (locations.length === 0) {
        setStage("zone-finished");
        return;
      }

      await activateLocation(locations[0]);
      setStage("scan");
    } catch (err) {
      setError(err.message || "Nie udalo sie uruchomic strefy");
    } finally {
      setSubmitting(false);
    }
  }

  async function moveToNextLocation() {
    const nextIndex = currentIndex + 1;

    setScanValue("");
    setDecisionScanValue("");
    setSurplusData({ ean: "", sku: "", lot: "", quantity: "" });
    setProblemNote("");

    if (nextIndex >= totalLocations) {
      setCompletedZones((current) =>
        current.includes(selectedZone) ? current : [...current, selectedZone]
      );
      setStage("zone-finished");
      return;
    }

    const nextLocation = queue[nextIndex];
    await activateLocation(nextLocation);
    setCurrentIndex(nextIndex);
    setStage("scan");
  }

  function resetToZonePicker() {
    setSelectedZone("");
    setQueue([]);
    setTotalCount(0);
    setCurrentIndex(0);
    setQuickStartInfo(null);
    setScanValue("");
    setDecisionScanValue("");
    setProblemNote("");
    setError("");
    setStage("zones");
  }

  async function handleExitProcess() {
    try {
      setSubmitting(true);
      setError("");

      if (lockedLocationIdRef.current) {
        await releaseLocationWork({ locationId: lockedLocationIdRef.current });
        lockedLocationIdRef.current = null;
      }

      await endSession();
      navigate("/process");
    } catch (err) {
      setError(err.message || "Nie udalo sie zamknac procesu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleScanConfirm() {
    if (!currentLocation) {
      return;
    }

    const normalizedInput = scanValue.trim().toLowerCase();
    const normalizedLocation = String(currentLocation.code || "").trim().toLowerCase();

    if (!normalizedInput) {
      setError("Najpierw zeskanuj albo wpisz lokalizacje.");
      return;
    }

    if (normalizedInput !== normalizedLocation) {
      setError("Skan nie zgadza sie z aktualna lokalizacja.");
      return;
    }

    setError("");
    setDecisionScanValue("");
    setStage("decision");
  }

  async function handleDecisionScanConfirm() {
    if (!currentLocation) {
      return;
    }

    const normalizedInput = decisionScanValue.trim().toLowerCase();
    const normalizedLocation = String(currentLocation.code || "").trim().toLowerCase();

    if (!normalizedInput) {
      setError("Zeskanuj albo wpisz aktualna lokalizacje, aby szybko potwierdzic pusty adres.");
      return;
    }

    if (normalizedInput !== normalizedLocation) {
      setError("Skan nie zgadza sie z aktualna lokalizacja.");
      return;
    }

    setError("");
    await handleConfirmEmpty();
  }

  async function handleConfirmEmpty() {
    if (!currentLocation || !session?.session_id) {
      return;
    }

    try {
      setSubmitting(true);
      await confirmEmptyLocation({
        location: currentLocation,
        user,
        sessionId: session.session_id,
        zone: selectedZone,
      });

      lockedLocationIdRef.current = null;
      addOperation({
        location: currentLocation.code,
        zone: selectedZone,
        type: "pusta_lokalizacja",
        quantity: 0,
      });
      await moveToNextLocation();
    } catch (err) {
      setError(err.message || "Nie udalo sie potwierdzic pustej lokalizacji.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProblemReport(reason) {
    if (!currentLocation || !session?.session_id) {
      return;
    }

    try {
      setSubmitting(true);
      await reportLocationProblem({
        location: currentLocation,
        user,
        sessionId: session.session_id,
        zone: selectedZone,
        reason,
        note: problemNote.trim() || null,
      });

      lockedLocationIdRef.current = null;
      addOperation({
        location: currentLocation.code,
        zone: selectedZone,
        type: "problem",
        quantity: 0,
        reason,
      });
      await moveToNextLocation();
    } catch (err) {
      setError(err.message || "Nie udalo sie zapisac problemu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSurplusSubmit() {
    if (!currentLocation || !session?.session_id || !user?.id) {
      return;
    }

    const quantity = Number(surplusData.quantity);

    if (!surplusData.sku.trim()) {
      setError("SKU jest wymagane.");
      return;
    }

    if (!quantity || quantity <= 0) {
      setError("Ilosc musi byc wieksza od zera.");
      return;
    }

    try {
      setSubmitting(true);

      const resolvedProduct = await resolveProductForSurplus({
        sku: surplusData.sku.trim(),
        ean: surplusData.ean || null,
      });

      if (!resolvedProduct) {
        throw new Error("Nie znaleziono SKU lub EAN w kartotece produktow.");
      }

      const normalizedPayload = {
        ean: surplusData.ean || resolvedProduct.ean || null,
        sku: resolvedProduct.sku,
        lot: surplusData.lot || null,
        quantity,
      };

      await reportLocationSurplus({
        location: currentLocation,
        user,
        sessionId: session.session_id,
        zone: selectedZone,
        ean: normalizedPayload.ean,
        sku: normalizedPayload.sku,
        lot: normalizedPayload.lot,
        quantity: normalizedPayload.quantity,
      });

      lockedLocationIdRef.current = null;
      addOperation({
        session_id: session.session_id,
        operator: user.email,
        site_id: user.site_id,
        user_id: user.id,
        operation_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        location: currentLocation.code,
        type: "surplus",
        ...normalizedPayload,
      });

      await moveToNextLocation();
    } catch (err) {
      setError(err.message || "Nie udalo sie zapisac nadwyzki.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!session?.session_id || !isActive) {
    return (
      <PageShell
        compact
        title="Brak aktywnej sesji"
        subtitle="Uruchom proces z menu, aby rozpoczac kontrole pustych lokalizacji."
        icon={<Warehouse size={26} />}
        backTo="/menu"
      >
        <div className="app-card">
          <Button onClick={() => navigate("/menu")} size="lg">
            Powrot do menu
          </Button>
        </div>
      </PageShell>
    );
  }

  const progress = totalLocations ? `${Math.min(currentIndex + 1, totalLocations)}/${totalLocations}` : "-";

  return (
    <PageShell
      compact
      title="Inwentaryzacja pustych lokalizacji"
      subtitle="Sprawdzaj lokalizacje jedna po drugiej, potwierdzaj puste miejsca i raportuj wyjatki bez opuszczania flow."
      icon={<Warehouse size={26} />}
      backTo="/process"
      onBack={handleExitProcess}
      backLabel="Powrot do wyboru procesu"
    >
      <div className="process-layout">
        {quickStartInfo ? (
          <div className="app-card">
            <div className="process-stage-header">
              <div className="process-stage-header__icon">
                <ArrowRight size={22} />
              </div>
              <div className="process-stage-header__text">
                <h2>Szybki start aktywny</h2>
                <p>
                  Start od lokalizacji {quickStartInfo.anchorCode} w strefie {quickStartInfo.zone}. Kolejnosc zostala ustawiona{" "}
                  {quickStartInfo.directionLabel}.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {selectedZone ? (
          <SummaryCard zone={selectedZone} progress={progress} location={currentLocation?.code} />
        ) : null}

        {error ? <div className="input-error-text">{error}</div> : null}

        {loading ? (
          <div className="app-card">Ladowanie stref...</div>
        ) : null}

        {!loading && stage === "zones" ? (
          <div className="app-card process-panel">
            <div>
              <h2 className="process-panel__title">Wybierz strefe startowa</h2>
              <p className="process-panel__subtitle">
                Strefy sa pokazywane jako wygodne kafle, a po ukonczeniu znikaja z listy.
              </p>
            </div>

            {availableZones.length === 0 ? (
              <div className="app-empty-state">
                Brak kolejnych stref z aktywnymi lokalizacjami do sprawdzenia.
              </div>
            ) : (
              <div className="process-zone-grid">
                {availableZones.map((zone) => (
                  <button
                    key={zone}
                    type="button"
                    className="card selectable process-zone-card"
                    disabled={submitting}
                    onClick={() => beginZone(zone)}
                  >
                    <div className="process-zone-card__value">{zone}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="process-actions">
              <Button variant="secondary" size="lg" loading={submitting} onClick={handleExitProcess}>
                Zakoncz i wroc do wyboru procesu
              </Button>
            </div>
          </div>
        ) : null}

        {stage === "scan" && currentLocation ? (
          <div className="app-card process-stage-card">
            <div className="process-stage-header">
              <div className="process-stage-header__icon">
                <ScanLine size={22} />
              </div>
              <div className="process-stage-header__text">
                <h2>Potwierdz lokalizacje</h2>
                <p>Zeskanuj kod lub wpisz go recznie, aby przejsc dalej.</p>
              </div>
            </div>

            <div className="scan-placeholder">{currentLocation.code}</div>

            <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
              <input
                ref={scanInputRef}
                className="input"
                placeholder="Zeskanuj lub wpisz kod lokalizacji"
                value={scanValue}
                onChange={(event) => setScanValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleScanConfirm();
                  }
                }}
              />
              {isScannerEnabledForField("location") ? (
                <button
                  type="button"
                  className="app-icon-button"
                  onClick={() => openScanner("location", "Skanuj lokalizacje")}
                  aria-label="Otworz skaner lokalizacji"
                  style={{ minWidth: 46, alignSelf: "stretch" }}
                >
                  <ScanLine size={18} />
                </button>
              ) : null}
            </div>

            <div className="process-actions">
              <Button size="lg" loading={submitting} onClick={handleScanConfirm}>
                Potwierdz skan
              </Button>
            </div>
          </div>
        ) : null}

        {stage === "decision" && currentLocation ? (
          <div className="app-card process-stage-card">
            <div className="process-stage-header">
              <div className="process-stage-header__icon">
                <ClipboardCheck size={22} />
              </div>
              <div className="process-stage-header__text">
                <h2>Czy lokalizacja jest pusta?</h2>
                <p>Wybierz dalszy krok dla aktualnej lokalizacji w strefie {selectedZone}.</p>
              </div>
            </div>

            <div className="process-meta-grid">
              <div className="process-meta-item">
                <div className="process-meta-item__label">Strefa</div>
                <div className="process-meta-item__value">{selectedZone}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">Lokalizacja</div>
                <div className="process-meta-item__value">{currentLocation.code}</div>
              </div>
            </div>

            <div className="process-section-card">
              <h3 className="process-section-card__title">Szybkie potwierdzenie skanem</h3>
              <div className="process-section-grid">
                <input
                  ref={decisionInputRef}
                  className="input"
                  placeholder="Zeskanuj aktualna lokalizacje i zatwierdz Enterem"
                  value={decisionScanValue}
                  onChange={(event) => setDecisionScanValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleDecisionScanConfirm();
                    }
                  }}
                />
                {isScannerEnabledForField("location") ? (
                  <button
                    type="button"
                    className="app-icon-button"
                    onClick={() => openScanner("decision-location", "Skanuj lokalizacje do potwierdzenia")}
                    aria-label="Otworz skaner potwierdzenia lokalizacji"
                    style={{ minWidth: 46, alignSelf: "stretch" }}
                  >
                    <ScanLine size={18} />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="process-choice-grid">
              <button
                type="button"
                className="card selectable process-choice-card"
                disabled={submitting}
                onClick={handleConfirmEmpty}
              >
                <div className="process-choice-card__title">Tak, jest pusta</div>
                <div className="process-choice-card__desc">
                  Zapisz lokalizacje jako sprawdzona i przejdz do kolejnej.
                </div>
              </button>

              <button
                type="button"
                className="card selectable process-choice-card"
                disabled={submitting}
                onClick={() => {
                  setError("");
                  setStage("surplus");
                }}
              >
                <div className="process-choice-card__title">Dodaj towar</div>
                <div className="process-choice-card__desc">
                  Zarejestruj znaleziona nadwyzke z poziomu tej lokalizacji.
                </div>
              </button>

              <button
                type="button"
                className="card selectable process-choice-card"
                disabled={submitting}
                onClick={() => {
                  setError("");
                  setProblemNote("");
                  setStage("problem");
                }}
              >
                <div className="process-choice-card__title">Zglos problem</div>
                <div className="process-choice-card__desc">
                  Dodaj problem operacyjny lub identyfikacyjny bez przerywania pracy.
                </div>
              </button>
            </div>
          </div>
        ) : null}

        {stage === "problem" && currentLocation ? (
          <div className="app-card process-stage-card">
            <div className="process-stage-header">
              <div className="process-stage-header__icon">
                <AlertTriangle size={22} />
              </div>
              <div className="process-stage-header__text">
                <h2>Wybierz typ problemu</h2>
                <p>Opis zostanie zapisany razem z lokalizacja i aktualnym operatorem.</p>
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
                  key={option.value}
                  type="button"
                  className="card selectable process-choice-card"
                  disabled={submitting}
                  onClick={() => handleProblemReport(option.value)}
                >
                  <div className="process-choice-card__title">{option.title}</div>
                  <div className="process-choice-card__desc">{option.description}</div>
                </button>
              ))}
            </div>

            <div className="process-actions">
              <Button variant="secondary" size="lg" onClick={() => setStage("decision")}>
                Wroc
              </Button>
            </div>
          </div>
        ) : null}

        {stage === "surplus" && currentLocation ? (
          <div className="app-card process-stage-card">
            <div className="process-stage-header">
              <div className="process-stage-header__icon">
                <PackagePlus size={22} />
              </div>
              <div className="process-stage-header__text">
                <h2>Dodaj towar dla {currentLocation.code}</h2>
                <p>Uzupelnij dane produktu i zapisz nadwyzke bez opuszczania procesu.</p>
              </div>
            </div>

            <div className="process-section-grid">
              <EanStepModern
                value={surplusData.ean}
                onChange={(value) => setSurplusData((current) => ({ ...current, ean: value }))}
                scannerEnabled={isScannerEnabledForField("ean")}
                onOpenScanner={() => openScanner("surplus-ean", "Skanuj EAN produktu")}
              />
              <SkuStepModern
                value={surplusData.sku}
                onChange={(value) => setSurplusData((current) => ({ ...current, sku: value }))}
                scannerEnabled={isScannerEnabledForField("sku")}
                onOpenScanner={() => openScanner("surplus-sku", "Skanuj SKU produktu")}
              />
              <LotStepModern
                value={surplusData.lot}
                onChange={(value) => setSurplusData((current) => ({ ...current, lot: value }))}
                scannerEnabled={isScannerEnabledForField("lot")}
                onOpenScanner={() => openScanner("surplus-lot", "Skanuj numer LOT")}
              />
              <QuantityStepModern
                value={surplusData.quantity}
                onChange={(value) => setSurplusData((current) => ({ ...current, quantity: value }))}
              />
            </div>

            <div className="process-actions">
              <Button size="lg" loading={submitting} onClick={handleSurplusSubmit}>
                Zapisz towar
              </Button>
              <Button variant="secondary" size="lg" onClick={() => setStage("decision")}>
                Wroc
              </Button>
            </div>
          </div>
        ) : null}

        {stage === "zone-finished" ? (
          <div className="app-card process-stage-card">
            <div className="process-stage-header">
              <div className="process-stage-header__icon">
                <CheckCircle2 size={22} />
              </div>
              <div className="process-stage-header__text">
                <h2>Strefa zakonczona</h2>
                <p>Ta czesc magazynu zostala juz obsluzona i jest gotowa do zamkniecia.</p>
              </div>
            </div>

            <div className="process-meta-grid">
              <div className="process-meta-item">
                <div className="process-meta-item__label">Strefa</div>
                <div className="process-meta-item__value">{selectedZone || "-"}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">Sprawdzone lokalizacje</div>
                <div className="process-meta-item__value">{totalLocations}</div>
              </div>
            </div>

            <div className="process-actions">
              <Button size="lg" onClick={resetToZonePicker}>
                Rozpocznij nastepna strefe
              </Button>
              <Button variant="secondary" size="lg" loading={submitting} onClick={handleExitProcess}>
                Zakoncz i wroc do wyboru procesu
              </Button>
            </div>
          </div>
        ) : null}

        <BarcodeScannerModal
          open={scannerModal.open}
          title={scannerModal.title}
          description="Skieruj aparat na kod albo wgraj zdjecie. Odczyt trafia bezposrednio do aktualnego pola procesu pustych lokalizacji."
          formats={
            scannerModal.fieldKey?.includes("ean")
              ? getScanFieldConfig("ean")?.formats || []
              : scannerModal.fieldKey?.includes("sku")
                ? getScanFieldConfig("sku")?.formats || []
                : scannerModal.fieldKey?.includes("lot")
                  ? getScanFieldConfig("lot")?.formats || []
                  : getScanFieldConfig("location")?.formats || []
          }
          preferBackCamera={Boolean(scannerConfig.preferBackCamera)}
          autoCloseOnSuccess={Boolean(scannerConfig.autoCloseOnSuccess)}
          onDetected={handleScannerDetected}
          onClose={closeScanner}
        />
        <LoadingOverlay
          open={submitting}
          fullscreen
          message="Przetwarzam lokalizacje i zapisuje postep kontroli..."
        />
      </div>
    </PageShell>
  );
}
