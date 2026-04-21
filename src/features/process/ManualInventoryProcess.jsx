import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardList, PauseCircle, ScanSearch, ShieldAlert, Warehouse } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoadingOverlay from "../../components/loaders/LoadingOverlay";
import PageShell from "../../components/layout/PageShell";
import BarcodeScannerModal from "../../components/scanner/BarcodeScannerModal";
import Button from "../../components/ui/Button";
import { useAuth } from "../../core/auth/AppAuth";
import { useAppPreferences } from "../../core/preferences/AppPreferences";
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

function SummaryCard({ location, zone, savedCount, sessionZone, copy }) {
  const rows = [
    [copy.currentLocationLabel, location?.code || "-"],
    [copy.zoneLabel, location?.zone || zone || sessionZone || "-"],
    [copy.operationsAtLocationLabel, String(savedCount || 0)],
  ];

  return (
    <div className="app-card process-sidebar-card">
      <div className="process-sidebar-card__header">
        <div className="process-sidebar-card__icon">
          <Warehouse size={18} />
        </div>
        <div>
          <h3 className="process-sidebar-card__title">{copy.currentLocationCardTitle}</h3>
          <p className="process-panel__subtitle">{copy.currentLocationCardSubtitle}</p>
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
  const { language } = useAppPreferences();
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
  const [endSessionModalOpen, setEndSessionModalOpen] = useState(false);
  const [scannerModal, setScannerModal] = useState({
    open: false,
    fieldKey: null,
    title: "",
  });
  const locationStartedAtRef = useRef(null);
  const lockedLocationIdRef = useRef(null);

  const validationConfig = config?.validation || {};
  const stepConfig = config?.steps || {};
  const copy = useMemo(
    () =>
      ({
        pl: {
          problemOptions: ["Towar uszkodzony", "Problem z iloscia towaru", "Brak identyfikacji towaru"],
          currentLocationLabel: "Lokalizacja",
          zoneLabel: "Strefa",
          operationsAtLocationLabel: "Operacje w lokalizacji",
          currentLocationCardTitle: "Biezaca lokalizacja",
          currentLocationCardSubtitle: "Podglad aktywnego miejsca pracy i licznika zapisow.",
          eanLabel: "EAN",
          skuLabel: "SKU",
          lotLabel: "LOT",
          expiryLabel: "Data waznosci",
          typeLabel: "Typ",
          quantityLabel: "Ilosc",
          stageLocation: "Skan lokalizacji",
          stageDetails: "Uzupelnianie operacji",
          stageSummary: "Podsumowanie",
          stageSaved: "Zapis zakonczony",
          stageProblem: "Raport problemu",
          stageDefault: "Proces reczny",
          stageLocationNote: "Pracujesz teraz na lokalizacji {{code}}.",
          stageFallbackNote: "Po wyborze lokalizacji tutaj zobaczysz jej kontekst.",
          loadError: "Blad uruchamiania procesu recznego",
          flushSent: "Wyslano z bufora {{count}} operacji.",
          flushRestored: "Przywrocono polaczenie. Wyslano {{count}} operacji.",
          timeWarning: "Przekroczono limit czasu kontroli tej lokalizacji.",
          fetchLocationError: "Nie udalo sie pobrac lokalizacji",
          missingLocation: "Brak aktywnej lokalizacji",
          requiredSku: "SKU jest wymagane",
          requiredEan: "EAN jest wymagany",
          invalidEan: "Niepoprawny format EAN",
          invalidSku: "Niepoprawny format SKU",
          requiredLot: "LOT jest wymagany",
          invalidLot: "Niepoprawny format LOT",
          requiredExpiry: "Data waznosci jest wymagana",
          invalidDate: "Niepoprawny format daty",
          requiredType: "Wybierz typ operacji",
          requiredQuantity: "Ilosc musi byc wieksza od zera",
          quantityHardLimit: "Ilosc przekracza dopuszczalny limit",
          quantityWarning: "Ilosc przekracza zalecany limit dla jednej operacji.",
          stockWarning: "SKU nie wystepuje w stocku tej lokalizacji.",
          summaryError: "Nie mozna przejsc dalej",
          bufferedSave: "Brak polaczenia lub timeout API. Operacja trafila do lokalnego bufora.",
          saveError: "Nie udalo sie zapisac operacji",
          scannerEan: "Skanuj EAN",
          scannerSku: "Skanuj SKU",
          scannerLot: "Skanuj numer LOT",
          finishLocationError: "Nie udalo sie zakonczyc lokalizacji",
          releaseLocationError: "Nie udalo sie zwrocic lokalizacji do puli",
          savedProblemMessage: "Problem zostal zapisany. Lokalizacja pozostaje zablokowana do czasu zwolnienia w panelu Problemy.",
          saveProblemError: "Nie udalo sie zapisac problemu",
          noSession: "Brak aktywnej sesji",
          loadingProcess: "Ladowanie procesu recznego...",
          title: "Reczna inwentaryzacja",
          subtitle: "Proces recznej inwentaryzacji z wyraznym kontekstem sesji i spokojnym ukladem pracy.",
          backLabel: "Zakoncz sesje i wyjdz",
          chooseStartLocation: "Wybierz lokalizacje startowa",
          chooseStartLocationDesc: "Zeskanuj lub wpisz lokalizacje, a potem przejdziemy do operacji w tej konkretnej pozycji.",
          scanLocation: "Skanuj lokalizacje",
          confirmLocation: "Potwierdz lokalizacje",
          operationTitle: "Uzupelnij operacje dla lokalizacji",
          operationDesc: "Pracuj krok po kroku i dopisz wszystkie potrzebne dane dla tej lokalizacji.",
          summaryAction: "Podsumowanie",
          changeLocation: "Zmien lokalizacje",
          reportProblem: "Zglos problem",
          reportProblemTitle: "Zglos problem dla lokalizacji",
          reportProblemDesc: "Zapisz problem i zostaw lokalizacje zablokowana do dalszej obslugi w panelu danych.",
          optionalProblemNote: "Opcjonalny komentarz do problemu",
          problemCardDesc: "Zapisz problem i zablokuj lokalizacje do czasu zwolnienia w panelu danych.",
          back: "Wroc",
          summaryTitle: "Podsumowanie operacji",
          summaryDesc: "Sprawdz wszystko jeszcze raz przed zapisem.",
          saveOperation: "Zapisz operacje",
          savedTitle: "Operacja zapisana",
          savedDesc: "Mozesz dodac kolejny wpis albo zamknac aktualna lokalizacje i przejsc dalej.",
          savedOperationsLabel: "Zapisane operacje",
          addNextOperation: "Dodaj kolejna operacje",
          finishLocation: "Zakoncz lokalizacje",
          returnLocation: "Zwroc lokalizacje do puli",
          processStateTitle: "Stan procesu",
          processStateSubtitle: "Etap, kontekst sesji i aktualne priorytety operatora.",
          currentDataTitle: "Biezace dane",
          sessionControlTitle: "Sterowanie sesja",
          pauseWork: "Wstrzymaj prace",
          endSession: "Zakoncz sesje",
          endSessionTitle: "Zakonczyc sesje recznej inwentaryzacji?",
          endSessionDesc: "Biezaca lokalizacja zostanie zwrocona do puli, a operator wroci do menu glownego.",
          cancel: "Anuluj",
          endAndReturn: "Zakoncz sesje i wroc do menu",
          stayInProcess: "Zostan w procesie",
          scanDescription: "Zeskanuj kod aparatem telefonu albo wgraj zdjecie z aparatu. Po odczycie wartosc zostanie wpisana do pola procesu.",
          overlay: "Aktualizuje lokalizacje i zapisuje operacje magazynowe...",
        },
        en: {
          problemOptions: ["Damaged goods", "Quantity issue", "Product cannot be identified"],
          currentLocationLabel: "Location",
          zoneLabel: "Zone",
          operationsAtLocationLabel: "Operations at location",
          currentLocationCardTitle: "Current location",
          currentLocationCardSubtitle: "Preview of the active work spot and saved operations counter.",
          eanLabel: "EAN",
          skuLabel: "SKU",
          lotLabel: "LOT",
          expiryLabel: "Expiry date",
          typeLabel: "Type",
          quantityLabel: "Quantity",
          stageLocation: "Location scan",
          stageDetails: "Operation details",
          stageSummary: "Summary",
          stageSaved: "Saved",
          stageProblem: "Issue report",
          stageDefault: "Manual process",
          stageLocationNote: "You are currently working on location {{code}}.",
          stageFallbackNote: "Once a location is selected, its context will appear here.",
          loadError: "Could not start the manual process",
          flushSent: "Sent {{count}} operations from the buffer.",
          flushRestored: "Connection restored. Sent {{count}} operations.",
          timeWarning: "The control time limit for this location has been exceeded.",
          fetchLocationError: "Could not load the location",
          missingLocation: "No active location",
          requiredSku: "SKU is required",
          requiredEan: "EAN is required",
          invalidEan: "Invalid EAN format",
          invalidSku: "Invalid SKU format",
          requiredLot: "LOT is required",
          invalidLot: "Invalid LOT format",
          requiredExpiry: "Expiry date is required",
          invalidDate: "Invalid date format",
          requiredType: "Select operation type",
          requiredQuantity: "Quantity must be greater than zero",
          quantityHardLimit: "Quantity exceeds the allowed limit",
          quantityWarning: "Quantity exceeds the recommended limit for a single operation.",
          stockWarning: "SKU is not present in the stock of this location.",
          summaryError: "Cannot continue",
          bufferedSave: "No connection or API timeout. The operation was saved to the local buffer.",
          saveError: "Could not save the operation",
          scannerEan: "Scan EAN",
          scannerSku: "Scan SKU",
          scannerLot: "Scan LOT number",
          finishLocationError: "Could not finish the location",
          releaseLocationError: "Could not return the location to the pool",
          savedProblemMessage: "The issue was saved. The location stays blocked until it is released in the Problems panel.",
          saveProblemError: "Could not save the issue",
          noSession: "No active session",
          loadingProcess: "Loading manual process...",
          title: "Manual inventory",
          subtitle: "Manual inventory flow with clear session context and focused workspace layout.",
          backLabel: "End session and leave",
          chooseStartLocation: "Choose starting location",
          chooseStartLocationDesc: "Scan or enter the location, then continue with operations for this exact position.",
          scanLocation: "Scan location",
          confirmLocation: "Confirm location",
          operationTitle: "Fill in operation details",
          operationDesc: "Work step by step and complete all required data for this location.",
          summaryAction: "Summary",
          changeLocation: "Change location",
          reportProblem: "Report issue",
          reportProblemTitle: "Report issue for location",
          reportProblemDesc: "Save the issue and leave the location blocked for further handling in the data panel.",
          optionalProblemNote: "Optional issue note",
          problemCardDesc: "Save the issue and block the location until it is released in the data panel.",
          back: "Back",
          summaryTitle: "Operation summary",
          summaryDesc: "Review everything once more before saving.",
          saveOperation: "Save operation",
          savedTitle: "Operation saved",
          savedDesc: "You can add another entry or close the current location and move on.",
          savedOperationsLabel: "Saved operations",
          addNextOperation: "Add another operation",
          finishLocation: "Finish location",
          returnLocation: "Return location to pool",
          processStateTitle: "Process status",
          processStateSubtitle: "Stage, session context and current operator priorities.",
          currentDataTitle: "Current data",
          sessionControlTitle: "Session controls",
          pauseWork: "Pause work",
          endSession: "End session",
          endSessionTitle: "End the manual inventory session?",
          endSessionDesc: "The current location will be returned to the pool and the operator will go back to the main menu.",
          cancel: "Cancel",
          endAndReturn: "End session and return to menu",
          stayInProcess: "Stay in process",
          scanDescription: "Scan the code with the phone camera or upload a camera photo. The detected value will be written into the process field.",
          overlay: "Updating locations and saving warehouse operations...",
        },
        de: {
          problemOptions: ["Beschadigte Ware", "Mengenproblem", "Produkt nicht identifizierbar"],
          currentLocationLabel: "Lokation",
          zoneLabel: "Zone",
          operationsAtLocationLabel: "Operationen an der Lokation",
          currentLocationCardTitle: "Aktuelle Lokation",
          currentLocationCardSubtitle: "Vorschau des aktiven Arbeitsplatzes und des Zaehlers gespeicherter Operationen.",
          eanLabel: "EAN",
          skuLabel: "SKU",
          lotLabel: "LOT",
          expiryLabel: "Verfallsdatum",
          typeLabel: "Typ",
          quantityLabel: "Menge",
          stageLocation: "Lokationsscan",
          stageDetails: "Operationsdaten",
          stageSummary: "Zusammenfassung",
          stageSaved: "Gespeichert",
          stageProblem: "Problemmeldung",
          stageDefault: "Manueller Prozess",
          stageLocationNote: "Du arbeitest aktuell an Lokation {{code}}.",
          stageFallbackNote: "Nach der Auswahl einer Lokation wird hier ihr Kontext angezeigt.",
          loadError: "Der manuelle Prozess konnte nicht gestartet werden",
          flushSent: "{{count}} Operationen aus dem Puffer wurden gesendet.",
          flushRestored: "Verbindung wiederhergestellt. {{count}} Operationen gesendet.",
          timeWarning: "Das Zeitlimit fur die Kontrolle dieser Lokation wurde uberschritten.",
          fetchLocationError: "Lokation konnte nicht geladen werden",
          missingLocation: "Keine aktive Lokation",
          requiredSku: "SKU ist erforderlich",
          requiredEan: "EAN ist erforderlich",
          invalidEan: "Ungueltiges EAN-Format",
          invalidSku: "Ungueltiges SKU-Format",
          requiredLot: "LOT ist erforderlich",
          invalidLot: "Ungueltiges LOT-Format",
          requiredExpiry: "Verfallsdatum ist erforderlich",
          invalidDate: "Ungueltiges Datumsformat",
          requiredType: "Operationstyp auswahlen",
          requiredQuantity: "Menge muss groesser als null sein",
          quantityHardLimit: "Menge uberschreitet das erlaubte Limit",
          quantityWarning: "Die Menge uberschreitet das empfohlene Limit fur eine einzelne Operation.",
          stockWarning: "SKU ist im Bestand dieser Lokation nicht vorhanden.",
          summaryError: "Fortfahren nicht moglich",
          bufferedSave: "Keine Verbindung oder API-Timeout. Die Operation wurde im lokalen Puffer gespeichert.",
          saveError: "Operation konnte nicht gespeichert werden",
          scannerEan: "EAN scannen",
          scannerSku: "SKU scannen",
          scannerLot: "LOT-Nummer scannen",
          finishLocationError: "Lokation konnte nicht abgeschlossen werden",
          releaseLocationError: "Lokation konnte nicht in den Pool zuruckgegeben werden",
          savedProblemMessage: "Das Problem wurde gespeichert. Die Lokation bleibt gesperrt, bis sie im Problem-Panel freigegeben wird.",
          saveProblemError: "Problem konnte nicht gespeichert werden",
          noSession: "Keine aktive Sitzung",
          loadingProcess: "Manueller Prozess wird geladen...",
          title: "Manuelle Inventur",
          subtitle: "Manueller Inventurprozess mit klarem Sitzungsbezug und fokussiertem Arbeitslayout.",
          backLabel: "Sitzung beenden und verlassen",
          chooseStartLocation: "Startlokation wahlen",
          chooseStartLocationDesc: "Scanne oder gib die Lokation ein und fahre dann mit den Operationen fur genau diese Position fort.",
          scanLocation: "Lokation scannen",
          confirmLocation: "Lokation bestatigen",
          operationTitle: "Operationsdaten erfassen",
          operationDesc: "Arbeite Schritt fur Schritt und ergaenze alle erforderlichen Daten fur diese Lokation.",
          summaryAction: "Zusammenfassung",
          changeLocation: "Lokation wechseln",
          reportProblem: "Problem melden",
          reportProblemTitle: "Problem fur Lokation melden",
          reportProblemDesc: "Speichere das Problem und lasse die Lokation fur die weitere Bearbeitung im Datenbereich gesperrt.",
          optionalProblemNote: "Optionaler Kommentar zum Problem",
          problemCardDesc: "Speichere das Problem und sperre die Lokation, bis sie im Datenbereich freigegeben wird.",
          back: "Zuruck",
          summaryTitle: "Operationszusammenfassung",
          summaryDesc: "Prufe alles noch einmal vor dem Speichern.",
          saveOperation: "Operation speichern",
          savedTitle: "Operation gespeichert",
          savedDesc: "Du kannst einen weiteren Eintrag hinzufugen oder die aktuelle Lokation abschliessen und weitergehen.",
          savedOperationsLabel: "Gespeicherte Operationen",
          addNextOperation: "Weitere Operation hinzufugen",
          finishLocation: "Lokation abschliessen",
          returnLocation: "Lokation in Pool zuruckgeben",
          processStateTitle: "Prozessstatus",
          processStateSubtitle: "Schritt, Sitzungskontext und aktuelle Prioritaeten des Operators.",
          currentDataTitle: "Aktuelle Daten",
          sessionControlTitle: "Sitzungssteuerung",
          pauseWork: "Arbeit pausieren",
          endSession: "Sitzung beenden",
          endSessionTitle: "Manuelle Inventursitzung beenden?",
          endSessionDesc: "Die aktuelle Lokation wird in den Pool zuruckgegeben und der Operator kehrt ins Hauptmenu zuruck.",
          cancel: "Abbrechen",
          endAndReturn: "Sitzung beenden und zum Menu zuruck",
          stayInProcess: "Im Prozess bleiben",
          scanDescription: "Scanne den Code mit der Handykamera oder lade ein Foto hoch. Der erkannte Wert wird in das Prozessfeld ubernommen.",
          overlay: "Lokationen werden aktualisiert und Lageroperationen gespeichert...",
        },
      })[language],
    [language],
  );
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
        stepConfig.location?.enabled !== false ? [copy.currentLocationLabel, currentLocation?.code || "-"] : null,
        currentLocation?.zone || currentZone ? [copy.zoneLabel, currentLocation?.zone || currentZone || "-"] : null,
        stepConfig.ean?.enabled ? [copy.eanLabel, form.ean || "-"] : null,
        stepConfig.sku?.enabled ? [copy.skuLabel, form.sku || "-"] : null,
        stepConfig.lot?.enabled ? [copy.lotLabel, form.lot || "-"] : null,
        stepConfig.expiry?.enabled ? [copy.expiryLabel, form.expiry || "-"] : null,
        stepConfig.type?.enabled ? [copy.typeLabel, form.type || "-"] : null,
        stepConfig.quantity?.enabled ? [copy.quantityLabel, form.quantity || "-"] : null,
      ].filter(Boolean),
    [copy, currentLocation?.code, currentLocation?.zone, currentZone, form, stepConfig]
  );

  const processStageLabel = useMemo(() => {
    switch (stage) {
      case "location":
        return copy.stageLocation;
      case "details":
        return copy.stageDetails;
      case "summary":
        return copy.stageSummary;
      case "saved":
        return copy.stageSaved;
      case "problem":
        return copy.stageProblem;
      default:
        return copy.stageDefault;
    }
  }, [copy, stage]);

  const processStageNote = useMemo(() => {
    if (stage === "location") {
      return "";
    }

    if (currentLocation) {
      return copy.stageLocationNote.replace("{{code}}", currentLocation.code);
    }

    return copy.stageFallbackNote;
  }, [copy, currentLocation, stage]);

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
          setBufferMessage(copy.flushSent.replace("{{count}}", flushResult.sent));
        }
      } catch (initError) {
        if (!cancelled) {
          setError(initError.message || copy.loadError);
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
        setBufferMessage(copy.flushRestored.replace("{{count}}", flushResult.sent));
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, [copy.flushRestored, copy.flushSent, copy.loadError, user?.site_id]);

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
        setTimeWarning(copy.timeWarning);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [copy.timeWarning, currentLocation, validationConfig.locationTimeoutMs]);

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
      setLocationStock(
        await fetchLocationStockSnapshot(location.id, Number(validationConfig.fetchRetries || 2), user?.site_id)
      );
      setSavedCountForLocation(0);
      setProblemNote("");
      resetForm();
      setStage("details");
    } catch (locationError) {
      setError(locationError.message || copy.fetchLocationError);
    } finally {
      setSubmitting(false);
    }
  }

  async function validateOperation() {
    const nextWarnings = [];
    const normalizedQuantity = Number(form.quantity);

    if (!currentLocation?.code) {
      throw new Error(copy.missingLocation);
    }

    if (stepConfig.sku?.enabled && stepConfig.sku?.mandatory && !form.sku.trim()) {
      throw new Error(copy.requiredSku);
    }

    if (stepConfig.ean?.enabled && stepConfig.ean?.mandatory && !form.ean.trim()) {
      throw new Error(copy.requiredEan);
    }

    if (validationConfig.eanPattern && form.ean) {
      const eanRegex = new RegExp(validationConfig.eanPattern);
      if (!eanRegex.test(form.ean.trim())) {
        throw new Error(validationConfig.eanMessage || copy.invalidEan);
      }
    }

    if (validationConfig.skuPattern && form.sku) {
      const skuRegex = new RegExp(validationConfig.skuPattern);
      if (!skuRegex.test(form.sku.trim())) {
        throw new Error(validationConfig.skuMessage || copy.invalidSku);
      }
    }

    const product = await resolveManualProduct({
      sku: form.sku,
      ean: form.ean,
      siteId: user?.site_id,
    });

    const lotRegex = new RegExp(validationConfig.lotPattern || "^[A-Za-z0-9._/-]{1,50}$");

    if (stepConfig.lot?.enabled && stepConfig.lot?.mandatory && !form.lot.trim()) {
      throw new Error(copy.requiredLot);
    }

    if (form.lot && !lotRegex.test(form.lot.trim())) {
      throw new Error(validationConfig.lotMessage || copy.invalidLot);
    }

    if (stepConfig.expiry?.enabled && stepConfig.expiry?.mandatory && !form.expiry) {
      throw new Error(copy.requiredExpiry);
    }

    if (form.expiry && !isValidIsoDate(form.expiry)) {
      throw new Error(copy.invalidDate);
    }

    if (stepConfig.type?.enabled && stepConfig.type?.mandatory && !form.type) {
      throw new Error(copy.requiredType);
    }

    if (stepConfig.quantity?.enabled && stepConfig.quantity?.mandatory && (!normalizedQuantity || normalizedQuantity <= 0)) {
      throw new Error(copy.requiredQuantity);
    }

    if (Number(validationConfig.quantityHardLimit || 0) > 0 && normalizedQuantity > Number(validationConfig.quantityHardLimit)) {
      throw new Error(validationConfig.quantityHardLimitMessage || copy.quantityHardLimit);
    }

    if (normalizedQuantity > quantityWarningThreshold) {
      nextWarnings.push(copy.quantityWarning);
    }

    const stockMatch = locationStock.find(
      (row) =>
        (
          row.productId === product.id ||
          (row.sku && row.sku === product.sku) ||
          (row.ean && (product.matched_barcode || product.ean) && row.ean === (product.matched_barcode || product.ean))
        ) &&
        (!form.lot || !row.lot || row.lot === form.lot)
    );

    if (!stockMatch) {
      nextWarnings.push(copy.stockWarning);
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
      setError(validationError.message || copy.summaryError);
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
        ean: form.ean || product.matched_barcode || product.ean || null,
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
        setBufferMessage(copy.bufferedSave);
      } else {
        setBufferMessage("");
      }

      resetForm();
      setStage("saved");
    } catch (saveError) {
      setError(saveError.message || copy.saveError);
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
            onOpenScanner={() => openScanner("ean", copy.scannerEan)}
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
            onOpenScanner={() => openScanner("sku", copy.scannerSku)}
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
            onOpenScanner={() => openScanner("lot", copy.scannerLot)}
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
      setError(finishError.message || copy.finishLocationError);
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
      setError(releaseError.message || copy.releaseLocationError);
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
      setBufferMessage(copy.savedProblemMessage);
    } catch (problemError) {
      setError(problemError.message || copy.saveProblemError);
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

  function requestEndSession() {
    setEndSessionModalOpen(true);
  }

  function closeEndSessionModal() {
    if (submitting) {
      return;
    }

    setEndSessionModalOpen(false);
  }

  async function confirmEndSession() {
    try {
      setSubmitting(true);
      await handleEndSession();
    } finally {
      setEndSessionModalOpen(false);
      setSubmitting(false);
    }
  }

  async function handlePauseSession() {
    await handleAbandonLocation();
    await pauseSession();
    setSessionZone("");
    setCurrentZone("");
    navigate("/menu");
  }

  if (!session?.session_id || !isActive) {
    return <div className="screen-title">{copy.noSession}</div>;
  }

  if (loading || !config) {
    return <div className="screen-title">{copy.loadingProcess}</div>;
  }

  return (
    <PageShell
      title={copy.title}
      subtitle={copy.subtitle}
      icon={<ScanSearch size={26} />}
      onBack={requestEndSession}
      backLabel={copy.backLabel}
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
                  <h2>{copy.chooseStartLocation}</h2>
                  <p>{copy.chooseStartLocationDesc}</p>
                </div>
              </div>

              <LocationStep
                value={locationInput}
                onChange={setLocationInput}
                error=""
                scannerEnabled={isScannerEnabledForField("location")}
                onOpenScanner={() => openScanner("location", copy.scanLocation)}
              />

              <div className="process-actions process-actions--tight">
                <Button size="lg" loading={submitting} onClick={handleLocationConfirm}>
                  {copy.confirmLocation}
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
                  <h2>{copy.operationTitle}</h2>
                  <p>{copy.operationDesc}</p>
                </div>
              </div>

              <div className="process-section-grid">
                {orderedSteps
                  .filter((step) => !["location", "confirmation"].includes(step.key))
                  .map(renderDetailStep)}
              </div>

              <div className="process-actions">
                <Button size="lg" loading={submitting} onClick={handleSummary}>
                  {copy.summaryAction}
                </Button>
                <Button variant="secondary" size="lg" disabled={submitting} onClick={handleAbandonLocation}>
                  {copy.changeLocation}
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
                  {copy.reportProblem}
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
                  <h2>{copy.reportProblemTitle}</h2>
                  <p>{copy.reportProblemDesc}</p>
                </div>
              </div>

              <div className="process-meta-grid">
                <div className="process-meta-item">
                  <div className="process-meta-item__label">{copy.currentLocationLabel}</div>
                  <div className="process-meta-item__value">{currentLocation.code}</div>
                </div>
                <div className="process-meta-item">
                  <div className="process-meta-item__label">{copy.zoneLabel}</div>
                  <div className="process-meta-item__value">{currentLocation.zone || currentZone || "-"}</div>
                </div>
              </div>

              <textarea
                className="input"
                placeholder={copy.optionalProblemNote}
                value={problemNote}
                onChange={(event) => setProblemNote(event.target.value)}
                style={{ minHeight: 120 }}
              />

              <div className="process-choice-grid">
                {copy.problemOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="card selectable process-choice-card"
                    disabled={submitting}
                    onClick={() => handleReportProblem(option)}
                  >
                    <div className="process-choice-card__title">{option}</div>
                    <div className="process-choice-card__desc">
                      {copy.problemCardDesc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="process-actions process-actions--tight">
                <Button variant="secondary" size="lg" disabled={submitting} onClick={() => setStage("details")}>
                  {copy.back}
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
                  <h2>{copy.summaryTitle}</h2>
                  <p>{copy.summaryDesc}</p>
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
                  {copy.saveOperation}
                </Button>
                <Button variant="secondary" size="lg" disabled={submitting} onClick={() => setStage("details")}>
                  {copy.back}
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
                  <h2>{copy.savedTitle}</h2>
                  <p>{copy.savedDesc}</p>
                </div>
              </div>

              <div className="process-meta-grid">
                <div className="process-meta-item">
                  <div className="process-meta-item__label">{copy.currentLocationLabel}</div>
                  <div className="process-meta-item__value">{currentLocation?.code || "-"}</div>
                </div>
                <div className="process-meta-item">
                  <div className="process-meta-item__label">{copy.savedOperationsLabel}</div>
                  <div className="process-meta-item__value">{savedCountForLocation}</div>
                </div>
              </div>

              <div className="process-actions">
                <Button size="lg" disabled={submitting} onClick={() => setStage("details")}>
                  {copy.addNextOperation}
                </Button>
                <Button variant="secondary" size="lg" disabled={submitting} onClick={handleFinishLocation}>
                  {copy.finishLocation}
                </Button>
                <Button variant="secondary" size="lg" disabled={submitting} onClick={handleAbandonLocation}>
                  {copy.returnLocation}
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
                <h3 className="process-sidebar-card__title">{copy.processStateTitle}</h3>
                <p className="process-panel__subtitle">{copy.processStateSubtitle}</p>
              </div>
            </div>

            <div className="process-sidebar-stage">{processStageLabel}</div>
            {processStageNote ? <div className="process-sidebar-note">{processStageNote}</div> : null}
          </div>

          {currentLocation ? (
            <SummaryCard
              location={currentLocation}
              zone={currentZone}
              sessionZone={sessionZone}
              savedCount={savedCountForLocation}
              copy={copy}
            />
          ) : null}

          {summaryRows.length > 0 && stage !== "summary" ? (
            <div className="app-card process-sidebar-card">
              <div className="process-sidebar-card__header">
                <div className="process-sidebar-card__icon">
                  <ClipboardList size={18} />
                </div>
              <div>
                <h3 className="process-sidebar-card__title">{copy.currentDataTitle}</h3>
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
                <h3 className="process-sidebar-card__title">{copy.sessionControlTitle}</h3>
              </div>
            </div>

            <div className="process-actions process-actions--stack">
              <Button variant="secondary" size="lg" disabled={submitting} onClick={handlePauseSession}>
                <PauseCircle size={16} />
                {copy.pauseWork}
              </Button>
              <Button variant="secondary" size="lg" disabled={submitting} onClick={requestEndSession}>
                {copy.endSession}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {endSessionModalOpen ? (
        <div className="history-modal-overlay" onClick={closeEndSessionModal}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <div className="history-modal__header">
              <div>
                <h2 className="process-panel__title" style={{ fontSize: 26, margin: 0 }}>
                  {copy.endSessionTitle}
                </h2>
                <p className="process-panel__subtitle">
                  {copy.endSessionDesc}
                </p>
              </div>
              <Button variant="secondary" onClick={closeEndSessionModal}>
                {copy.cancel}
              </Button>
            </div>

            <div className="process-meta-grid" style={{ marginBottom: 18 }}>
              <div className="process-meta-item">
                <div className="process-meta-item__label">{copy.currentLocationLabel}</div>
                <div className="process-meta-item__value">{currentLocation?.code || "-"}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">{copy.zoneLabel}</div>
                <div className="process-meta-item__value">{currentLocation?.zone || currentZone || sessionZone || "-"}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">{copy.savedOperationsLabel}</div>
                <div className="process-meta-item__value">{savedCountForLocation}</div>
              </div>
            </div>

            <div className="process-actions">
              <Button size="lg" loading={submitting} onClick={confirmEndSession}>
                {copy.endAndReturn}
              </Button>
              <Button variant="secondary" size="lg" disabled={submitting} onClick={closeEndSessionModal}>
                {copy.stayInProcess}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <BarcodeScannerModal
        open={scannerModal.open}
        title={scannerModal.title}
        description={copy.scanDescription}
        formats={scannerModal.fieldKey ? getScanFieldConfig(scannerModal.fieldKey)?.formats || [] : []}
        preferBackCamera={Boolean(scanningConfig.preferBackCamera)}
        autoCloseOnSuccess={Boolean(scanningConfig.autoCloseOnSuccess)}
        onDetected={handleScannerDetected}
        onClose={closeScanner}
      />
      <LoadingOverlay
        open={submitting}
        fullscreen
        message={copy.overlay}
      />
    </PageShell>
  );
}
