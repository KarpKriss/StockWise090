import { AlertCircle, Camera, CameraOff, ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAppPreferences } from "../../core/preferences/AppPreferences";
import Button from "../ui/Button";

const HTML5_QRCODE_CDN = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";

let html5QrcodeLoaderPromise = null;

function loadHtml5QrcodeScript(copy) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error(copy.browserOnly));
  }

  if (window.Html5Qrcode) {
    return Promise.resolve(window.Html5Qrcode);
  }

  if (!html5QrcodeLoaderPromise) {
    html5QrcodeLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[data-html5-qrcode="true"]`);
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.Html5Qrcode));
        existingScript.addEventListener("error", () => reject(new Error(copy.libraryError)));
        return;
      }

      const script = document.createElement("script");
      script.src = HTML5_QRCODE_CDN;
      script.async = true;
      script.defer = true;
      script.dataset.html5Qrcode = "true";
      script.onload = () => resolve(window.Html5Qrcode);
      script.onerror = () => reject(new Error(copy.libraryError));
      document.body.appendChild(script);
    });
  }

  return html5QrcodeLoaderPromise;
}

function resolveSupportedFormats(formats) {
  if (typeof window === "undefined" || !window.Html5QrcodeSupportedFormats) {
    return [];
  }

  const supportedFormats = window.Html5QrcodeSupportedFormats;
  return (formats || [])
    .map((format) => supportedFormats[String(format || "").trim().toUpperCase()])
    .filter((value) => value !== undefined);
}

async function startScannerInstance({ scanner, preferBackCamera, onDetected }) {
  const onDecode = (decodedText, decodedResult) => {
    const normalizedValue = String(decodedText || "").trim();
    if (normalizedValue) {
      const rawFormat =
        decodedResult?.result?.format?.formatName ||
        decodedResult?.result?.format?.format ||
        decodedResult?.format?.formatName ||
        decodedResult?.format?.format ||
        decodedResult?.decodedResult?.format?.formatName ||
        decodedResult?.decodedResult?.format?.format ||
        null;

      onDetected(normalizedValue, {
        rawFormat: rawFormat ? String(rawFormat).trim() : null,
        decodedResult: decodedResult || null,
        source: "camera",
      });
    }
  };

  try {
    await scanner.start(
      preferBackCamera ? { facingMode: "environment" } : { facingMode: "user" },
      {
        fps: 10,
        qrbox: { width: 260, height: 180 },
        aspectRatio: 1.7777778,
        rememberLastUsedCamera: true,
      },
      onDecode,
      () => {}
    );
    return;
  } catch (firstError) {
    const cameras = await window.Html5Qrcode.getCameras();
    const chosenCamera = preferBackCamera
      ? cameras.find((camera) => /back|rear|environment/i.test(camera.label || "")) || cameras[0]
      : cameras[0];

    if (!chosenCamera?.id) {
      throw firstError;
    }

    await scanner.start(
      chosenCamera.id,
      {
        fps: 10,
        qrbox: { width: 260, height: 180 },
        aspectRatio: 1.7777778,
        rememberLastUsedCamera: true,
      },
      onDecode,
      () => {}
    );
  }
}

export default function BarcodeScannerModal({
  open,
  title,
  description,
  formats = [],
  preferBackCamera = true,
  autoCloseOnSuccess = true,
  onDetected,
  onDetectedDetail = null,
  onClose,
}) {
  const { language } = useAppPreferences();
  const copy = useMemo(
    () =>
      ({
        pl: {
          browserOnly: "Skaner kamery dziala tylko w przegladarce.",
          libraryError: "Nie udalo sie pobrac biblioteki skanera.",
          bootError: "Nie udalo sie uruchomic kamery. Sprawdz uprawnienia albo uzyj zdjecia z aparatu.",
          fileEmpty: "Na zdjeciu nie wykryto zadnego kodu.",
          fileError: "Nie udalo sie odczytac kodu ze zdjecia.",
          defaultTitle: "Skanowanie kodu",
          defaultDescription: "Skieruj aparat na kod kreskowy lub QR. Mozesz tez wgrac zdjecie z aparatu.",
          closeAria: "Zamknij skaner",
          uploadPhoto: "Wgraj zdjecie",
          close: "Zamknij",
          allowedFormats: "Dozwolone formaty",
          allFormats: "wszystkie wspierane przez skaner",
          loading: "Uruchamiam aparat i silnik skanowania...",
          ready: "Kamera jest aktywna. Trzymaj telefon stabilnie i wypelnij caly kod w ramce.",
        },
        en: {
          browserOnly: "Camera scanner works only in the browser.",
          libraryError: "Could not download the scanner library.",
          bootError: "Could not start the camera. Check permissions or use a camera photo instead.",
          fileEmpty: "No code was detected in the photo.",
          fileError: "Could not read the code from the photo.",
          defaultTitle: "Scan code",
          defaultDescription: "Point the camera at a barcode or QR code. You can also upload a photo from the camera.",
          closeAria: "Close scanner",
          uploadPhoto: "Upload photo",
          close: "Close",
          allowedFormats: "Allowed formats",
          allFormats: "all formats supported by the scanner",
          loading: "Starting the camera and scanning engine...",
          ready: "Camera is active. Hold the phone steady and fit the whole code inside the frame.",
        },
        de: {
          browserOnly: "Der Kamerascanner funktioniert nur im Browser.",
          libraryError: "Die Scanner-Bibliothek konnte nicht geladen werden.",
          bootError: "Die Kamera konnte nicht gestartet werden. Bitte Berechtigungen prufen oder ein Foto verwenden.",
          fileEmpty: "Auf dem Foto wurde kein Code erkannt.",
          fileError: "Der Code konnte vom Foto nicht gelesen werden.",
          defaultTitle: "Code scannen",
          defaultDescription: "Richte die Kamera auf einen Barcode oder QR-Code. Du kannst auch ein Foto von der Kamera hochladen.",
          closeAria: "Scanner schliessen",
          uploadPhoto: "Foto hochladen",
          close: "Schliessen",
          allowedFormats: "Erlaubte Formate",
          allFormats: "alle vom Scanner unterstutzten Formate",
          loading: "Kamera und Scan-Engine werden gestartet...",
          ready: "Die Kamera ist aktiv. Halte das Telefon ruhig und bringe den gesamten Code in den Rahmen.",
        },
      })[language],
    [language]
  );
  const reactId = useId();
  const readerId = useMemo(() => `barcode-reader-${reactId.replace(/:/g, "")}`, [reactId]);
  const scannerRef = useRef(null);
  const activeRef = useRef(false);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;

    async function bootScanner() {
      try {
        setState("loading");
        setError("");
        await loadHtml5QrcodeScript(copy);

        if (cancelled) {
          return;
        }

        const scanner = new window.Html5Qrcode(readerId, {
          formatsToSupport: resolveSupportedFormats(formats),
          verbose: false,
        });

        scannerRef.current = scanner;
        await startScannerInstance({
          scanner,
          preferBackCamera,
          onDetected: (value, details) => {
            if (!activeRef.current) {
              return;
            }

            onDetected(value);
            if (typeof onDetectedDetail === "function") {
              onDetectedDetail({
                value,
                ...(details || {}),
              });
            }
            if (autoCloseOnSuccess) {
              onClose();
            }
          },
        });

        if (!cancelled) {
          setState("ready");
          activeRef.current = true;
        }
      } catch (bootError) {
        console.error("BARCODE SCANNER START ERROR:", bootError);
        if (!cancelled) {
          setState("error");
          setError(
            bootError?.message || copy.bootError
          );
        }
      }
    }

    bootScanner();

    return () => {
      cancelled = true;
      activeRef.current = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        Promise.resolve()
          .then(async () => {
            try {
              if (scanner.isScanning) {
                await scanner.stop();
              }
            } catch {}

            try {
              await scanner.clear();
            } catch {}
          })
          .catch(() => {});
      }
    };
  }, [open, readerId, formats, preferBackCamera, onDetected, onDetectedDetail, onClose, autoCloseOnSuccess, copy]);

  async function handleFileScan(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setError("");
      const scanner = scannerRef.current || new window.Html5Qrcode(readerId);
      scannerRef.current = scanner;
      let normalizedValue = "";
      let details = {
        rawFormat: null,
        decodedResult: null,
        source: "file",
      };

      if (typeof scanner.scanFileV2 === "function") {
        const result = await scanner.scanFileV2(file, true);
        normalizedValue = String(result?.decodedText || "").trim();
        details = {
          rawFormat:
            result?.result?.format?.formatName ||
            result?.result?.format?.format ||
            result?.format?.formatName ||
            result?.format?.format ||
            null,
          decodedResult: result || null,
          source: "file",
        };
      } else {
        const result = await scanner.scanFile(file, true);
        normalizedValue = String(result || "").trim();
      }

      if (!normalizedValue) {
        throw new Error(copy.fileEmpty);
      }

      onDetected(normalizedValue);
      if (typeof onDetectedDetail === "function") {
        onDetectedDetail({
          value: normalizedValue,
          ...details,
        });
      }
      if (autoCloseOnSuccess) {
        onClose();
      }
    } catch (scanError) {
      console.error("BARCODE FILE SCAN ERROR:", scanError);
      setError(scanError?.message || copy.fileError);
    } finally {
      event.target.value = "";
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.74)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="app-card"
        style={{
          width: "min(720px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>{title || copy.defaultTitle}</h3>
            <p className="helper-note" style={{ marginBottom: 0 }}>
              {description || copy.defaultDescription}
            </p>
          </div>
          <button type="button" className="app-icon-button" onClick={onClose} aria-label={copy.closeAria}>
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            background: "#0f172a",
          }}
        >
          <div id={readerId} style={{ width: "100%", minHeight: 300 }} />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <label className="app-button app-button--ghost app-button--md" style={{ cursor: "pointer" }}>
            <ImagePlus size={16} />
            {copy.uploadPhoto}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={handleFileScan}
            />
          </label>
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            <CameraOff size={16} />
            {copy.close}
          </Button>
        </div>

        <div className="helper-note" style={{ marginTop: 14 }}>
          {copy.allowedFormats}: <strong>{formats.length ? formats.join(", ") : copy.allFormats}</strong>
        </div>

        {state === "loading" ? (
          <div className="helper-note" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={16} className="spin" />
            {copy.loading}
          </div>
        ) : null}

        {state === "ready" ? (
          <div className="helper-note" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Camera size={16} />
            {copy.ready}
          </div>
        ) : null}

        {error ? (
          <div className="input-error-text" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} />
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
