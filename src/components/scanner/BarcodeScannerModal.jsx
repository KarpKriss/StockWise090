import { AlertCircle, Camera, CameraOff, ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Button from "../ui/Button";

const HTML5_QRCODE_CDN = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";

let html5QrcodeLoaderPromise = null;

function loadHtml5QrcodeScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Skaner kamery dziala tylko w przegladarce."));
  }

  if (window.Html5Qrcode) {
    return Promise.resolve(window.Html5Qrcode);
  }

  if (!html5QrcodeLoaderPromise) {
    html5QrcodeLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[data-html5-qrcode="true"]`);
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.Html5Qrcode));
        existingScript.addEventListener("error", () =>
          reject(new Error("Nie udalo sie pobrac biblioteki skanera."))
        );
        return;
      }

      const script = document.createElement("script");
      script.src = HTML5_QRCODE_CDN;
      script.async = true;
      script.defer = true;
      script.dataset.html5Qrcode = "true";
      script.onload = () => resolve(window.Html5Qrcode);
      script.onerror = () => reject(new Error("Nie udalo sie pobrac biblioteki skanera."));
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
  const onDecode = (decodedText) => {
    const normalizedValue = String(decodedText || "").trim();
    if (normalizedValue) {
      onDetected(normalizedValue);
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
  onClose,
}) {
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
        await loadHtml5QrcodeScript();

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
          onDetected: (value) => {
            if (!activeRef.current) {
              return;
            }

            onDetected(value);
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
            bootError?.message ||
              "Nie udalo sie uruchomic kamery. Sprawdz uprawnienia albo uzyj zdjecia z aparatu."
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
  }, [open, readerId, formats, preferBackCamera, onDetected, onClose, autoCloseOnSuccess]);

  async function handleFileScan(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setError("");
      const scanner = scannerRef.current || new window.Html5Qrcode(readerId);
      scannerRef.current = scanner;
      const result = await scanner.scanFile(file, true);
      const normalizedValue = String(result || "").trim();

      if (!normalizedValue) {
        throw new Error("Na zdjeciu nie wykryto zadnego kodu.");
      }

      onDetected(normalizedValue);
      if (autoCloseOnSuccess) {
        onClose();
      }
    } catch (scanError) {
      console.error("BARCODE FILE SCAN ERROR:", scanError);
      setError(scanError?.message || "Nie udalo sie odczytac kodu ze zdjecia.");
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
            <h3 style={{ marginBottom: 6 }}>{title || "Skanowanie kodu"}</h3>
            <p className="helper-note" style={{ marginBottom: 0 }}>
              {description || "Skieruj aparat na kod kreskowy lub QR. Mozesz tez wgrac zdjecie z aparatu."}
            </p>
          </div>
          <button type="button" className="app-icon-button" onClick={onClose} aria-label="Zamknij skaner">
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
            Wgraj zdjecie
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
            Zamknij
          </Button>
        </div>

        <div className="helper-note" style={{ marginTop: 14 }}>
          Dozwolone formaty: <strong>{formats.length ? formats.join(", ") : "wszystkie wspierane przez skaner"}</strong>
        </div>

        {state === "loading" ? (
          <div className="helper-note" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={16} className="spin" />
            Uruchamiam aparat i silnik skanowania...
          </div>
        ) : null}

        {state === "ready" ? (
          <div className="helper-note" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Camera size={16} />
            Kamera jest aktywna. Trzymaj telefon stabilnie i wypelnij caly kod w ramce.
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
