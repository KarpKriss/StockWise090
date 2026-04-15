import { Camera, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/layout/PageShell";
import Button from "../../components/ui/Button";
import { useAuth } from "../../core/auth/AppAuth";
import {
  DEFAULT_MANUAL_PROCESS_CONFIG,
  SCAN_FORMAT_OPTIONS,
  SCANNABLE_MANUAL_FIELDS,
  normalizeManualProcessConfig,
} from "../../core/config/manualProcessConfig";
import {
  fetchManualProcessAdminConfig,
  saveManualProcessAdminConfig,
} from "../../core/api/processConfigApi";

const FIELD_LABELS = {
  location: "Lokalizacja",
  ean: "EAN",
  sku: "SKU",
  lot: "LOT",
};

function Toggle({ label, checked, onChange, disabled = false, help = "" }) {
  return (
    <label className={`process-config-toggle ${disabled ? "is-disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {label}
        {help ? (
          <span style={{ display: "block", fontSize: 12, opacity: 0.72, marginTop: 4 }}>{help}</span>
        ) : null}
      </span>
    </label>
  );
}

export default function ScanningSettingsPanel() {
  const { user } = useAuth();
  const [configState, setConfigState] = useState(DEFAULT_MANUAL_PROCESS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveInfo, setSaveInfo] = useState("");
  const [dataSource, setDataSource] = useState("default");

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        setLoading(true);
        const result = await fetchManualProcessAdminConfig(user?.site_id);
        if (!cancelled) {
          setConfigState(result.config);
          setDataSource(result.source);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Nie udalo sie pobrac ustawien skanowania");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, [user?.site_id]);

  const scanning = configState.scanning || DEFAULT_MANUAL_PROCESS_CONFIG.scanning;

  const activeFieldsSummary = useMemo(
    () =>
      SCANNABLE_MANUAL_FIELDS.filter((fieldKey) => scanning.fields?.[fieldKey]?.enabled)
        .map((fieldKey) => FIELD_LABELS[fieldKey])
        .join(", "),
    [scanning.fields],
  );

  function updateScanning(patch) {
    setConfigState((current) =>
      normalizeManualProcessConfig({
        ...current,
        scanning: {
          ...current.scanning,
          ...patch,
        },
      }),
    );
    setSaveInfo("");
  }

  function updateField(fieldKey, patch) {
    setConfigState((current) =>
      normalizeManualProcessConfig({
        ...current,
        scanning: {
          ...current.scanning,
          fields: {
            ...current.scanning?.fields,
            [fieldKey]: {
              ...current.scanning?.fields?.[fieldKey],
              ...patch,
            },
          },
        },
      }),
    );
    setSaveInfo("");
  }

  function toggleFormat(fieldKey, format) {
    const currentFormats = scanning.fields?.[fieldKey]?.formats || [];
    const nextFormats = currentFormats.includes(format)
      ? currentFormats.filter((item) => item !== format)
      : [...currentFormats, format];

    updateField(fieldKey, { formats: nextFormats });
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      const normalized = normalizeManualProcessConfig(configState);

      if (normalized.scanning.enabled) {
        const hasEnabledField = SCANNABLE_MANUAL_FIELDS.some(
          (fieldKey) => normalized.scanning.fields?.[fieldKey]?.enabled,
        );

        if (!hasEnabledField) {
          throw new Error("Wlacz co najmniej jedno pole do skanowania.");
        }

        const fieldWithoutFormats = SCANNABLE_MANUAL_FIELDS.find(
          (fieldKey) =>
            normalized.scanning.fields?.[fieldKey]?.enabled &&
            !(normalized.scanning.fields?.[fieldKey]?.formats || []).length,
        );

        if (fieldWithoutFormats) {
          throw new Error(`Pole ${FIELD_LABELS[fieldWithoutFormats]} musi miec co najmniej jeden format kodu.`);
        }
      }

      const result = await saveManualProcessAdminConfig({
        siteId: user?.site_id,
        config: normalized,
      });

      setConfigState(result.config);
      setDataSource(result.source);
      setSaveInfo("Ustawienia skanowania zostaly zapisane.");
    } catch (saveError) {
      setError(saveError.message || "Nie udalo sie zapisac ustawien skanowania");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      title="Skanowanie"
      subtitle="Sterowanie skanerem aparatu w procesie recznej inwentaryzacji: wlaczenie, pola i obslugiwane formaty kodow."
      icon={<Camera size={26} />}
      backTo="/admin"
      backLabel="Powrot do ustawien"
      actions={
        <Button type="button" variant="primary" size="md" disabled={saving || loading} onClick={handleSave}>
          <Save size={16} />
          {saving ? "Zapisywanie..." : "Zapisz ustawienia"}
        </Button>
      }
    >
      {loading ? <div className="app-card">Pobieram ustawienia skanowania...</div> : null}
      {error ? <div className="input-error-text">{error}</div> : null}
      {saveInfo ? <div className="helper-note">{saveInfo}</div> : null}

      {!loading ? (
        <>
          <div className="app-card">
            <div className="system-status-section-header" style={{ marginBottom: 14 }}>
              <div>
                <h3>Tryb skanowania</h3>
                <p>Ta sekcja steruje ikonami aparatu i obsluga kamery na telefonach operatorow.</p>
              </div>
              <div className="system-status-section-summary">
                <span className="system-alert__pill system-alert__pill--healthy">Zrodlo: {dataSource}</span>
              </div>
            </div>

            <div className="process-config-step-list">
              <div className="process-config-step-card">
                <div className="process-config-step-card__main">
                  <div>
                    <div className="process-config-step-card__label">Globalne wlaczenie skanowania</div>
                  </div>
                </div>
                <div className="process-config-step-card__toggles">
                  <Toggle
                    label="Aktywne"
                    checked={Boolean(scanning.enabled)}
                    onChange={(value) => updateScanning({ enabled: value })}
                    help="Gdy wylaczone, wszystkie pola dzialaja tylko w trybie recznego wpisywania."
                  />
                  <Toggle
                    label="Zamknij po odczycie"
                    checked={Boolean(scanning.autoCloseOnSuccess)}
                    disabled={!scanning.enabled}
                    onChange={(value) => updateScanning({ autoCloseOnSuccess: value })}
                    help="Po poprawnym skanie modal kamery zamknie sie automatycznie."
                  />
                  <Toggle
                    label="Preferuj tylny aparat"
                    checked={Boolean(scanning.preferBackCamera)}
                    disabled={!scanning.enabled}
                    onChange={(value) => updateScanning({ preferBackCamera: value })}
                    help="Na telefonie system spróbuje od razu otworzyc tylny aparat."
                  />
                </div>
              </div>
            </div>

            <div className="helper-note" style={{ marginTop: 14 }}>
              Aktywne pola skanowania: <strong>{activeFieldsSummary || "Brak"}</strong>
            </div>
          </div>

          <div className="app-card" style={{ marginTop: 18 }}>
            <h3>Pola procesu</h3>
            <p className="helper-note">
              Dla kazdego pola wybierasz, czy pokazujemy ikonę aparatu i jakie typy kodow sa akceptowane.
            </p>

            <div className="process-config-step-list">
              {SCANNABLE_MANUAL_FIELDS.map((fieldKey) => {
                const fieldConfig = scanning.fields?.[fieldKey] || DEFAULT_MANUAL_PROCESS_CONFIG.scanning.fields[fieldKey];
                return (
                  <div key={fieldKey} className="process-config-step-card">
                    <div className="process-config-step-card__main" style={{ alignItems: "flex-start" }}>
                      <div style={{ width: "100%" }}>
                        <div className="process-config-step-card__key">{fieldKey}</div>
                        <div className="process-config-step-card__label">{FIELD_LABELS[fieldKey]}</div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                            gap: 10,
                            marginTop: 14,
                          }}
                        >
                          {SCAN_FORMAT_OPTIONS.map((option) => {
                            const active = fieldConfig.formats?.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className={`app-button app-button--${active ? "primary" : "ghost"} app-button--sm`}
                                disabled={!scanning.enabled || !fieldConfig.enabled}
                                onClick={() => toggleFormat(fieldKey, option.value)}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="process-config-step-card__toggles">
                      <Toggle
                        label="Ikona aparatu"
                        checked={Boolean(fieldConfig.enabled)}
                        disabled={!scanning.enabled}
                        onChange={(value) => updateField(fieldKey, { enabled: value })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
