import { Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/layout/PageShell";
import { useAuth } from "../../core/auth/AppAuth";
import {
  DEFAULT_MANUAL_PROCESS_CONFIG,
  MANUAL_STEP_DEFINITIONS,
  getOrderedEnabledManualSteps,
  normalizeManualProcessConfig,
} from "../../core/config/manualProcessConfig";
import {
  fetchManualProcessAdminConfig,
  saveManualProcessAdminConfig,
} from "../../core/api/processConfigApi";
import { fetchConfigChangeLogs } from "../../core/api/logsApi";

function ToggleField({ checked, onChange, disabled = false, label }) {
  return (
    <label className={`process-config-toggle ${disabled ? "is-disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export default function ProcessConfigPanel() {
  const { user } = useAuth();
  const [configState, setConfigState] = useState(DEFAULT_MANUAL_PROCESS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveInfo, setSaveInfo] = useState("");
  const [dataSource, setDataSource] = useState("default");
  const [historyRows, setHistoryRows] = useState([]);

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
          setError(loadError.message || "Nie udalo sie pobrac konfiguracji procesu");
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

  useEffect(() => {
    let cancelled = false;

    fetchConfigChangeLogs({ limit: 8 })
      .then((rows) => {
        if (!cancelled) {
          setHistoryRows(rows.filter((row) => row.entity === "manual_process" || row.entity === "process_config"));
        }
      })
      .catch((loadError) => {
        console.error("PROCESS CONFIG HISTORY LOAD ERROR:", loadError);
      });

    return () => {
      cancelled = true;
    };
  }, [saveInfo]);

  const stepRows = useMemo(
    () =>
      MANUAL_STEP_DEFINITIONS.map((definition) => ({
        key: definition.key,
        ...configState.steps[definition.key],
      })).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    [configState.steps],
  );

  const orderedPreview = useMemo(
    () => getOrderedEnabledManualSteps(configState).map((step) => step.label).join(" -> "),
    [configState],
  );

  function updateStep(key, patch) {
    setConfigState((current) => ({
      ...current,
      steps: {
        ...current.steps,
        [key]: {
          ...current.steps[key],
          ...patch,
        },
      },
    }));
    setSaveInfo("");
  }

  function updateValidation(key, value) {
    setConfigState((current) => ({
      ...current,
      validation: {
        ...current.validation,
        [key]: value,
      },
    }));
    setSaveInfo("");
  }

  function updateOperationType(key, patch) {
    setConfigState((current) => ({
      ...current,
      operationTypes: {
        ...current.operationTypes,
        [key]: {
          ...current.operationTypes[key],
          ...patch,
        },
      },
    }));
    setSaveInfo("");
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      const normalized = normalizeManualProcessConfig(configState);

      if (!normalized.steps.location?.enabled || !normalized.steps.location?.mandatory) {
        throw new Error("Krok lokalizacji musi pozostac wlaczony i obowiazkowy.");
      }

      if (!normalized.steps.type?.enabled || !normalized.steps.type?.mandatory) {
        throw new Error("Typ operacji musi pozostac wlaczony i obowiazkowy.");
      }

      if (!normalized.steps.quantity?.enabled || !normalized.steps.quantity?.mandatory) {
        throw new Error("Ilosc musi pozostac wlaczona i obowiazkowa.");
      }

      if (!normalized.steps.sku?.enabled && !normalized.steps.ean?.enabled) {
        throw new Error("Musisz pozostawic aktywne co najmniej jedno z pol: SKU albo EAN.");
      }

      if (!Object.values(normalized.operationTypes).some((item) => item.enabled)) {
        throw new Error("Co najmniej jeden typ operacji musi pozostac aktywny.");
      }

      const result = await saveManualProcessAdminConfig({
        siteId: user?.site_id,
        config: normalized,
      });
      setConfigState(result.config);
      setDataSource(result.source);
      setSaveInfo("Konfiguracja procesu recznego zostala zapisana.");
    } catch (saveError) {
      setError(saveError.message || "Nie udalo sie zapisac konfiguracji procesu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      title="Konfiguracja procesu"
      subtitle="Sterowanie reczna inwentaryzacja: kolejnosc krokow, widocznosc, wymagania i reguly walidacji. Proces pustych lokalizacji pozostaje niezalezny."
      icon={<SlidersHorizontal size={26} />}
      backTo="/admin"
      backLabel="Powrot do ustawien"
      actions={
        <button
          type="button"
          className="app-button app-button--primary app-button--md"
          disabled={saving || loading}
          onClick={handleSave}
        >
          <Save size={16} />
          {saving ? "Zapisywanie..." : "Zapisz konfiguracje"}
        </button>
      }
    >
      {loading ? <div className="app-card">Pobieram konfiguracje recznej inwentaryzacji...</div> : null}
      {error ? <div className="input-error-text">{error}</div> : null}
      {saveInfo ? <div className="helper-note">{saveInfo}</div> : null}

      {!loading ? (
        <>
          <div className="app-card">
            <div className="system-status-section-header" style={{ marginBottom: 14 }}>
              <div>
                <h3>Kroki procesu recznego</h3>
                <p>Zmieniaj kolejnosc, widocznosc i wymagalnosc poszczegolnych etapow.</p>
              </div>
              <div className="system-status-section-summary">
                <span className="system-alert__pill system-alert__pill--healthy">
                  Zrodlo: {dataSource}
                </span>
              </div>
            </div>

            <div className="process-config-step-list">
              {stepRows.map((step) => {
                const isLocked = ["location", "type", "quantity"].includes(step.key);
                return (
                  <div key={step.key} className="process-config-step-card">
                    <div className="process-config-step-card__main">
                      <div>
                        <div className="process-config-step-card__key">{step.key}</div>
                        <div className="process-config-step-card__label">{step.label}</div>
                      </div>
                      <div className="process-config-step-card__order">
                        <label>Kolejnosc</label>
                        <input
                          className="app-input"
                          type="number"
                          min="1"
                          value={step.order}
                          onChange={(event) => updateStep(step.key, { order: Number(event.target.value) || 1 })}
                        />
                      </div>
                    </div>

                    <div className="process-config-step-card__toggles">
                      <ToggleField
                        label="Widoczny"
                        checked={step.enabled}
                        disabled={isLocked}
                        onChange={(value) => updateStep(step.key, { enabled: value })}
                      />
                      <ToggleField
                        label="Obowiazkowy"
                        checked={step.mandatory}
                        disabled={isLocked}
                        onChange={(value) => updateStep(step.key, { mandatory: value })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="helper-note" style={{ marginTop: 14 }}>
              Kolejnosc aktywnych krokow: <strong>{orderedPreview || "Brak aktywnych krokow"}</strong>
            </div>
          </div>

          <div className="process-config-layout-grid">
            <div className="app-card">
              <h3>Dozwolone typy operacji</h3>
              <p className="helper-note">Ta konfiguracja dotyczy tylko recznej inwentaryzacji.</p>

              <div className="process-config-step-list">
                {Object.entries(configState.operationTypes).map(([key, value]) => (
                  <div key={key} className="process-config-step-card">
                    <div className="process-config-step-card__main">
                      <div>
                        <div className="process-config-step-card__key">{key}</div>
                        <div className="process-config-step-card__label">{value.label}</div>
                      </div>
                    </div>
                    <div className="process-config-step-card__toggles">
                      <ToggleField
                        label="Dostepny"
                        checked={value.enabled}
                        onChange={(enabled) => updateOperationType(key, { enabled })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="app-card">
              <h3>Walidacje i limity</h3>
              <div className="process-config-form-grid">
                <label>
                  <span>Regex LOT</span>
                  <input
                    className="app-input"
                    value={configState.validation.lotPattern}
                    onChange={(event) => updateValidation("lotPattern", event.target.value)}
                  />
                </label>

                <label>
                  <span>Komunikat LOT</span>
                  <input
                    className="app-input"
                    value={configState.validation.lotMessage}
                    onChange={(event) => updateValidation("lotMessage", event.target.value)}
                  />
                </label>

                <label>
                  <span>Regex EAN</span>
                  <input
                    className="app-input"
                    value={configState.validation.eanPattern}
                    onChange={(event) => updateValidation("eanPattern", event.target.value)}
                  />
                </label>

                <label>
                  <span>Komunikat EAN</span>
                  <input
                    className="app-input"
                    value={configState.validation.eanMessage}
                    onChange={(event) => updateValidation("eanMessage", event.target.value)}
                  />
                </label>

                <label>
                  <span>Regex SKU</span>
                  <input
                    className="app-input"
                    value={configState.validation.skuPattern}
                    onChange={(event) => updateValidation("skuPattern", event.target.value)}
                  />
                </label>

                <label>
                  <span>Komunikat SKU</span>
                  <input
                    className="app-input"
                    value={configState.validation.skuMessage}
                    onChange={(event) => updateValidation("skuMessage", event.target.value)}
                  />
                </label>

                <label>
                  <span>Prog ostrzezenia ilosci</span>
                  <input
                    className="app-input"
                    type="number"
                    min="1"
                    value={configState.validation.quantityWarningThreshold}
                    onChange={(event) =>
                      updateValidation("quantityWarningThreshold", Number(event.target.value) || 0)
                    }
                  />
                </label>

                <label>
                  <span>Twardy limit ilosci</span>
                  <input
                    className="app-input"
                    type="number"
                    min="1"
                    value={configState.validation.quantityHardLimit}
                    onChange={(event) =>
                      updateValidation("quantityHardLimit", Number(event.target.value) || 0)
                    }
                  />
                </label>

                <label>
                  <span>Komunikat limitu ilosci</span>
                  <input
                    className="app-input"
                    value={configState.validation.quantityHardLimitMessage}
                    onChange={(event) => updateValidation("quantityHardLimitMessage", event.target.value)}
                  />
                </label>

                <label>
                  <span>Limit czasu lokalizacji (ms)</span>
                  <input
                    className="app-input"
                    type="number"
                    min="1000"
                    step="1000"
                    value={configState.validation.locationTimeoutMs}
                    onChange={(event) =>
                      updateValidation("locationTimeoutMs", Number(event.target.value) || 0)
                    }
                  />
                </label>

                <label>
                  <span>Timeout zapisu API (ms)</span>
                  <input
                    className="app-input"
                    type="number"
                    min="1000"
                    step="1000"
                    value={configState.validation.saveTimeoutMs}
                    onChange={(event) =>
                      updateValidation("saveTimeoutMs", Number(event.target.value) || 0)
                    }
                  />
                </label>

                <label>
                  <span>Retry zapisu</span>
                  <input
                    className="app-input"
                    type="number"
                    min="0"
                    value={configState.validation.saveRetries}
                    onChange={(event) => updateValidation("saveRetries", Number(event.target.value) || 0)}
                  />
                </label>

                <label>
                  <span>Retry pobran</span>
                  <input
                    className="app-input"
                    type="number"
                    min="0"
                    value={configState.validation.fetchRetries}
                    onChange={(event) => updateValidation("fetchRetries", Number(event.target.value) || 0)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="app-card" style={{ marginTop: 18 }}>
            <div className="system-status-section-header">
              <div>
                <h3>Historia zmian konfiguracji</h3>
                <p>Ostatnie zapisy konfiguracji procesu recznego wraz z informacja, kto wprowadzil zmiane.</p>
              </div>
            </div>

            {historyRows.length ? (
              <div className="dashboard-table-scroll">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Czas</th>
                      <th>Uzytkownik</th>
                      <th>Akcja</th>
                      <th>Zakres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.timestamp ? new Date(row.timestamp).toLocaleString() : "-"}</td>
                        <td>{row.userName || row.userEmail || row.userId || "-"}</td>
                        <td>{row.eventType || "-"}</td>
                        <td>{row.entity || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="app-empty-state">Brak zapisanej historii zmian konfiguracji.</div>
            )}
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
