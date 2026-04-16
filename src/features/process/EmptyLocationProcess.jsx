import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../core/auth/AppAuth";
import { useSession } from "../../core/session/AppSession";
import { productMap } from "../../core/config/productMap";
import {
  confirmEmptyLocation,
  fetchEmptyLocationsForZone,
  fetchEmptyLocationZones,
  markLocationOnWork,
  releaseLocationWork,
  resolveProductForSurplus,
  reportLocationProblem,
  reportLocationSurplus,
} from "../../core/api/emptyLocationsApi";
import EanStep from "./steps/EanStep";
import SkuStep from "./steps/SkuStep";
import LotStep from "./steps/LotStep";
import QuantityStep from "./steps/QuantityStep";

const PROBLEM_OPTIONS = [
  "Towar uszkodzony",
  "Problem z iloscia towaru",
  "Brak identyfikacji towaru",
];

export default function EmptyLocationProcess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { session, isActive, addOperation } = useSession();
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
  const lockedLocationIdRef = useRef(null);

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
        const nextZones = await fetchEmptyLocationZones({ siteId: user.site_id });

        if (!cancelled) {
          setZones(nextZones);
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
    return () => {
      if (lockedLocationIdRef.current) {
        releaseLocationWork({ locationId: lockedLocationIdRef.current }).catch((releaseError) => {
          console.error("EMPTY PROCESS CLEANUP RELEASE ERROR:", releaseError);
        });
      }
    };
  }, []);

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

  async function releaseCurrentLocation() {
    if (!lockedLocationIdRef.current) {
      return;
    }

    const locationId = lockedLocationIdRef.current;
    lockedLocationIdRef.current = null;
    await releaseLocationWork({ locationId });
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
      setScanValue("");
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
    setSurplusData({
      ean: "",
      sku: "",
      lot: "",
      quantity: "",
    });
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

  async function handleScanConfirm() {
    if (!currentLocation) {
      return;
    }

    const normalizedInput = scanValue.trim().toLowerCase();
    const normalizedLocation = String(currentLocation.code || "").trim().toLowerCase();

    if (!normalizedInput) {
      setError("Najpierw zeskanuj albo wpisz lokalizacje");
      return;
    }

    if (normalizedInput !== normalizedLocation) {
      setError("Skan nie zgadza sie z aktualna lokalizacja");
      return;
    }

    setError("");
    setStage("decision");
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
      setError(err.message || "Nie udalo sie potwierdzic pustej lokalizacji");
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
      setError(err.message || "Nie udalo sie zapisac problemu");
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
      setError("SKU jest wymagane");
      return;
    }

    if (!quantity || quantity <= 0) {
      setError("Ilosc musi byc wieksza od zera");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        session_id: session.session_id,
        operator: user.email,
        site_id: user.site_id,
        user_id: user.id,
        operation_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        location: currentLocation.code,
        ean: surplusData.ean || null,
        sku: surplusData.sku.trim(),
        lot: surplusData.lot || null,
        type: "surplus",
        quantity,
      };

      const resolvedProduct = await resolveProductForSurplus({
        sku: payload.sku,
        ean: payload.ean,
        siteId: user?.site_id,
      });

      if (!resolvedProduct) {
        throw new Error("Nie znaleziono SKU lub EAN w kartotece produktow");
      }

      payload.sku = resolvedProduct.sku;
      payload.ean = payload.ean || resolvedProduct.ean || null;

      await reportLocationSurplus({
        location: currentLocation,
        user,
        sessionId: session.session_id,
        zone: selectedZone,
        ean: payload.ean,
        sku: payload.sku,
        lot: payload.lot,
        quantity: payload.quantity,
      });
      lockedLocationIdRef.current = null;
      addOperation(payload);
      await moveToNextLocation();
    } catch (err) {
      setError(err.message || "Nie udalo sie zapisac nadwyzki");
    } finally {
      setSubmitting(false);
    }
  }

  function resetToZonePicker() {
    setSelectedZone("");
    setQueue([]);
    setTotalCount(0);
    setCurrentIndex(0);
    setScanValue("");
    setProblemNote("");
    setError("");
    setStage("zones");
  }

  if (!session?.session_id || !isActive) {
    return <div className="screen-title">Brak aktywnej sesji</div>;
  }

  if (loading) {
    return <div className="screen-title">Ladowanie stref...</div>;
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="screen-title">Inwentaryzacja pustych lokalizacji</div>

      {selectedZone && totalLocations > 0 && (
        <div className="confirm-card" style={{ marginBottom: 20 }}>
          <div className="confirm-row">
            <span>Strefa</span>
            <span>{selectedZone}</span>
          </div>
          <div className="confirm-row">
            <span>Postep</span>
            <span>
              {Math.min(currentIndex + 1, totalLocations)}/{totalLocations}
            </span>
          </div>
          <div className="confirm-row">
            <span>Aktualna lokalizacja</span>
            <span>{currentLocation?.code || "-"}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="input-error-text" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {stage === "zones" && (
        <>
          <div className="confirm-header">Wybierz strefe</div>
          {availableZones.length === 0 && (
            <div className="confirm-card" style={{ marginBottom: 20 }}>
              Brak kolejnych stref z aktywnymi lokalizacjami do sprawdzenia.
            </div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            {availableZones.map((zone) => (
              <button
                key={zone}
                className="btn-secondary full"
                disabled={submitting}
                onClick={() => beginZone(zone)}
              >
                {zone}
              </button>
            ))}
          </div>

          <button
            className="btn-primary full"
            style={{ marginTop: 20 }}
            onClick={() => navigate("/menu")}
          >
            Powrot do menu
          </button>
        </>
      )}

      {stage === "scan" && currentLocation && (
        <>
          <div className="confirm-header">Potwierdz lokalizacje</div>
          <div className="scan-placeholder" style={{ marginBottom: 12 }}>
            {currentLocation.code}
          </div>
          <input
            className="input"
            placeholder="Zeskanuj lub wpisz kod lokalizacji"
            value={scanValue}
            onChange={(event) => setScanValue(event.target.value)}
          />
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button className="btn-primary full" disabled={submitting} onClick={handleScanConfirm}>
              Potwierdz skan
            </button>
          </div>
        </>
      )}

      {stage === "decision" && currentLocation && (
        <>
          <div className="confirm-header">Potwierdzasz, ze lokalizacja jest pusta?</div>
          <div className="confirm-card" style={{ marginBottom: 20 }}>
            <div className="confirm-row">
              <span>Strefa</span>
              <span>{selectedZone}</span>
            </div>
            <div className="confirm-row">
              <span>Lokalizacja</span>
              <span>{currentLocation.code}</span>
            </div>
          </div>

          <button className="btn-primary large full" disabled={submitting} onClick={handleConfirmEmpty}>
            Tak
          </button>
          <button
            className="btn-secondary full"
            style={{ marginTop: 12 }}
            disabled={submitting}
            onClick={() => {
              setError("");
              setStage("surplus");
            }}
          >
            Dodaj towar
          </button>
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

      {stage === "problem" && currentLocation && (
        <>
          <div className="confirm-header">Wybierz typ problemu</div>
          <textarea
            className="input"
            placeholder="Opcjonalny komentarz do problemu"
            value={problemNote}
            onChange={(event) => setProblemNote(event.target.value)}
            style={{ minHeight: 100, marginBottom: 16 }}
          />
          <div style={{ display: "grid", gap: 12 }}>
            {PROBLEM_OPTIONS.map((reason) => (
              <button
                key={reason}
                className="btn-secondary full"
                disabled={submitting}
                onClick={() => handleProblemReport(reason)}
              >
                {reason}
              </button>
            ))}
          </div>
          <button
            className="btn-primary full"
            style={{ marginTop: 16 }}
            disabled={submitting}
            onClick={() => setStage("decision")}
          >
            Wroc
          </button>
        </>
      )}

      {stage === "surplus" && currentLocation && (
        <>
          <div className="confirm-header">Dodaj towar dla {currentLocation.code}</div>
          <EanStep
            value={surplusData.ean}
            onChange={(value) =>
              setSurplusData((current) => ({
                ...current,
                ean: value,
                sku: productMap[value]?.sku || current.sku,
              }))
            }
          />
          <SkuStep
            value={surplusData.sku}
            onChange={(value) =>
              setSurplusData((current) => ({
                ...current,
                sku: value,
              }))
            }
          />
          <LotStep
            value={surplusData.lot}
            onChange={(value) =>
              setSurplusData((current) => ({
                ...current,
                lot: value,
              }))
            }
          />
          <QuantityStep
            value={surplusData.quantity}
            onChange={(value) =>
              setSurplusData((current) => ({
                ...current,
                quantity: value,
              }))
            }
          />

          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button className="btn-primary full" disabled={submitting} onClick={handleSurplusSubmit}>
              Zapisz towar
            </button>
            <button className="btn-secondary full" disabled={submitting} onClick={() => setStage("decision")}>
              Wroc
            </button>
          </div>
        </>
      )}

      {stage === "zone-finished" && (
        <>
          <div className="confirm-header">Gratuluje, zinwentaryzowales cala strefe</div>
          <div className="confirm-card" style={{ marginBottom: 20 }}>
            <div className="confirm-row">
              <span>Strefa</span>
              <span>{selectedZone || "-"}</span>
            </div>
            <div className="confirm-row">
              <span>Sprawdzone lokalizacje</span>
              <span>{totalLocations}</span>
            </div>
          </div>

          <button className="btn-primary full" onClick={resetToZonePicker}>
            Rozpocznij nastepna strefe
          </button>
          <button
            className="btn-secondary full"
            style={{ marginTop: 12 }}
            onClick={() => navigate("/menu")}
          >
            Powrot do menu
          </button>
        </>
      )}
    </div>
  );
}
