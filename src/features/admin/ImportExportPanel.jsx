import {
  ArrowLeftRight,
  Boxes,
  FileSpreadsheet,
  FileCog,
  History,
  MapPinned,
  Package,
  PlayCircle,
  Save,
  Tag,
  Upload,
  Warehouse,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/layout/PageShell";
import Button from "../../components/ui/Button";
import { useAuth } from "../../core/auth/AppAuth";
import {
  fetchImportExportMapping,
  fetchImportExportPreviewSample,
  saveImportExportMapping,
  validateImportExportEntityMapping,
} from "../../core/api/importExportConfigApi";
import {
  getDefaultImportExportMapping,
  IMPORT_EXPORT_ENTITIES,
} from "../../core/config/importExportDefaults";
import { getEntityDefinition, mergeImportExportMapping } from "../../core/utils/importExportMapping";
import { parseTabularFile } from "../../utils/tabularFile";
import { exportToCSV } from "../../utils/csvExport";

const ENTITY_ICONS = {
  products: Package,
  stock: Warehouse,
  prices: Tag,
  locations: MapPinned,
  corrections: History,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function SectionCard({ title, description, children }) {
  return (
    <div className="process-section-card import-config-section-card">
      <h3 className="process-section-card__title">{title}</h3>
      {description ? <p className="process-panel__subtitle">{description}</p> : null}
      {children}
    </div>
  );
}

export default function ImportExportPanel() {
  const { user } = useAuth();
  const [mapping, setMapping] = useState(getDefaultImportExportMapping());
  const [selectedEntity, setSelectedEntity] = useState("stock");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveInfo, setSaveInfo] = useState("");
  const [uploadedHeaders, setUploadedHeaders] = useState([]);
  const [templateSample, setTemplateSample] = useState([]);
  const [exportSample, setExportSample] = useState([]);

  useEffect(() => {
    async function loadMapping() {
      try {
        setLoading(true);
        const next = await fetchImportExportMapping(user?.site_id || null);
        setMapping(mergeImportExportMapping(next));
        setError("");
        setSaveInfo("");
      } catch (err) {
        setError(err.message || "Nie udalo sie pobrac konfiguracji mapowania");
      } finally {
        setLoading(false);
      }
    }

    loadMapping();
  }, [user?.site_id]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      try {
        const sample = await fetchImportExportPreviewSample(selectedEntity, mapping);
        if (!cancelled) {
          setExportSample(sample);
        }
      } catch (err) {
        if (!cancelled) {
          setExportSample([]);
        }
      }
    }

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [mapping, selectedEntity]);

  const entity = getEntityDefinition(selectedEntity);
  const entityMapping = useMemo(() => mergeImportExportMapping(mapping).entities[selectedEntity], [mapping, selectedEntity]);

  function updateImportField(fieldKey, patch) {
    setSaveInfo("");
    setMapping((current) => {
      const next = clone(mergeImportExportMapping(current));
      next.entities[selectedEntity].import.fields[fieldKey] = {
        ...next.entities[selectedEntity].import.fields[fieldKey],
        ...patch,
      };
      return next;
    });
  }

  function updateExportColumn(index, patch) {
    setSaveInfo("");
    setMapping((current) => {
      const next = clone(mergeImportExportMapping(current));
      next.entities[selectedEntity].export.columns[index] = {
        ...next.entities[selectedEntity].export.columns[index],
        ...patch,
      };
      return next;
    });
  }

  function resetSelectedEntity() {
    setSaveInfo("");
    setMapping((current) => {
      const defaults = getDefaultImportExportMapping();
      const next = clone(mergeImportExportMapping(current));
      next.entities[selectedEntity] = defaults.entities[selectedEntity];
      return next;
    });
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setSaveInfo("");
      const validationErrors = validateImportExportEntityMapping(entity, entityMapping);
      if (validationErrors.length) {
        throw new Error(validationErrors[0]);
      }
      const saved = await saveImportExportMapping(user?.site_id || null, mapping);
      setMapping(mergeImportExportMapping(saved));
      setSaveInfo(`Mapowanie dla sekcji "${entity.title}" zostalo zapisane.`);
    } catch (err) {
      setError(err.message || "Nie udalo sie zapisac konfiguracji");
    } finally {
      setSaving(false);
    }
  }

  function handleTemplateUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx";
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const parsed = await parseTabularFile(file);
        setUploadedHeaders(parsed.headers || []);
        setTemplateSample((parsed.rawRows || []).slice(0, 1));
        setError("");
      } catch (err) {
        setError(err.message || "Nie udalo sie odczytac naglowkow pliku");
      }
    };
    input.click();
  }

  function handleTestExport() {
    try {
      const validationErrors = validateImportExportEntityMapping(entity, entityMapping);
      if (validationErrors.length) {
        throw new Error(validationErrors[0]);
      }

      if (!exportSample.length) {
        throw new Error("Brak danych probnych do wygenerowania testowego eksportu.");
      }

      exportToCSV({
        data: [
          exportSample.reduce((acc, item) => {
            acc[item.header] = item.value;
            return acc;
          }, {}),
        ],
        columns: exportSample.map((item) => ({ key: item.header, label: item.header })),
        fileName: `test-export-${selectedEntity}.csv`,
      });
    } catch (err) {
      setError(err.message || "Nie udalo sie wygenerowac testowego eksportu");
    }
  }

  const validationErrors = useMemo(
    () => validateImportExportEntityMapping(entity, entityMapping),
    [entity, entityMapping],
  );

  return (
    <PageShell
      title="Import / Export"
      subtitle="Mapuj kolumny wejsciowe i naglowki eksportu dla danych referencyjnych bez zmian w kodzie."
      icon={<ArrowLeftRight size={26} />}
      backTo="/admin"
      backLabel="Powrot do ustawien"
      actions={
        <>
          <Button variant="secondary" onClick={resetSelectedEntity}>
            Przywroc domyslne
          </Button>
          <Button variant="secondary" onClick={handleTemplateUpload}>
            <Upload size={16} />
            Wgraj formatke
          </Button>
          <Button variant="secondary" onClick={handleTestExport}>
            <PlayCircle size={16} />
            Test eksportu
          </Button>
          <Button loading={saving} onClick={handleSave}>
            <Save size={16} />
            Zapisz mapowanie
          </Button>
        </>
      }
    >
      {error ? <div className="input-error-text">{error}</div> : null}
      {saveInfo ? <div className="helper-note">{saveInfo}</div> : null}
      {loading ? <div className="app-card">Ladowanie konfiguracji import/export...</div> : null}

      {!loading ? (
        <>
          <div className="app-grid app-grid--cards import-config-grid">
            {Object.values(IMPORT_EXPORT_ENTITIES).map((item) => {
              const Icon = ENTITY_ICONS[item.key] || FileCog;
              const active = selectedEntity === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  className={`card selectable import-config-tile ${active ? "import-config-tile--active" : ""}`}
                  onClick={() => setSelectedEntity(item.key)}
                >
                  <div className="menu-card__icon">
                    <Icon size={22} />
                  </div>
                  <div className="card-title" style={{ marginTop: 14 }}>{item.title}</div>
                  <div className="card-desc">{item.description}</div>
                </button>
              );
            })}
          </div>

          <div className="app-card import-config-editor-card">
            <div className="app-module-panel__header import-config-editor-card__header">
              <div>
                <h2 className="process-panel__title" style={{ fontSize: 28 }}>{entity.title}</h2>
                <p className="process-panel__subtitle">Skonfiguruj osobno import i eksport dla tego obszaru danych.</p>
              </div>
              <span className="history-status-chip">
                {entity.supportsImport ? "Import" : "Bez importu"} / {entity.supportsExport ? "Eksport" : "Bez eksportu"}
              </span>
            </div>

            {uploadedHeaders.length ? (
              <div className="app-card" style={{ marginBottom: 18 }}>
                <div className="system-status-section-header">
                  <div>
                    <h3>Odczytane naglowki pliku</h3>
                    <p>To wlasnie te kolumny mozna teraz wykorzystac do mapowania importu lub eksportu.</p>
                  </div>
                  <span className="history-status-chip">
                    <FileSpreadsheet size={14} style={{ marginRight: 6 }} />
                    {uploadedHeaders.length} kolumn
                  </span>
                </div>
                <div className="import-config-header-list">
                  {uploadedHeaders.map((header, index) => (
                    <span key={`${header}-${index}`} className="history-status-chip">
                      {index + 1}. {header}
                    </span>
                  ))}
                </div>
                {templateSample.length ? (
                  <div className="helper-note" style={{ marginTop: 12 }}>
                    Wczytano tez probke pierwszego wiersza pliku, wiec mozesz od razu porownac uklad danych z mapowaniem.
                  </div>
                ) : null}
              </div>
            ) : null}

            {validationErrors.length ? (
              <div className="app-card" style={{ marginBottom: 18 }}>
                <div className="input-error-text" style={{ marginBottom: 10 }}>
                  Walidacja mapowania wykryla problemy. Zapis jest ryzykowny, dopoki ich nie poprawisz.
                </div>
                <ul className="process-panel__list">
                  {validationErrors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="import-config-editor-layout">
              <SectionCard
                title="Mapowanie importu"
                description={
                  entity.supportsImport
                    ? "Wskaz, z jakiej kolumny pliku pobierac konkretne pole. Mozesz mapowac po nazwie naglowka lub po numerze kolumny."
                    : "Dla tego panelu import nie jest obslugiwany, bo to widok historyczny i auditowy."
                }
              >
                {entity.supportsImport ? (
                  <div className="import-mapping-list">
                    {entity.importFields.map((field) => {
                      const fieldConfig = entityMapping.import.fields[field.key] || { mode: "header", value: field.aliases?.[0] || field.key };
                      return (
                        <div className="import-mapping-row import-mapping-row--import" key={field.key}>
                          <div className="import-mapping-row__meta">
                            <div className="import-mapping-row__title">{field.label}</div>
                            <div className="helper-note">
                              {field.required ? "Pole wymagane" : "Pole opcjonalne"}
                            </div>
                          </div>
                          <div className="import-mapping-row__controls import-mapping-row__controls--import">
                            <div className="import-mapping-row__control">
                              <label className="app-field__label">Tryb mapowania</label>
                              <select
                                className="import-mapping-input"
                                value={fieldConfig.mode}
                                onChange={(event) => updateImportField(field.key, { mode: event.target.value })}
                              >
                                <option value="header">Naglowek</option>
                                <option value="index">Numer kolumny</option>
                              </select>
                            </div>
                            <div className="import-mapping-row__control">
                              <label className="app-field__label">
                                {fieldConfig.mode === "index" ? "Numer kolumny" : "Nazwa naglowka"}
                              </label>
                              <input
                                className="import-mapping-input"
                                type={fieldConfig.mode === "index" ? "number" : "text"}
                                min={1}
                                value={fieldConfig.value || ""}
                                onChange={(event) => updateImportField(field.key, { value: event.target.value })}
                                placeholder={fieldConfig.mode === "index" ? "Np. 4" : "Np. sku albo ilosc"}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="app-empty-state">Ten obszar ma tylko konfiguracje eksportu.</div>
                )}
              </SectionCard>

              <SectionCard
                title="Mapowanie eksportu"
                description="Ustaw kolejnosc kolumn, ich nazwy w pliku i to, ktore dane maja trafic do eksportu."
              >
                <div className="import-mapping-list">
                  {entityMapping.export.columns.map((column, index) => (
                    <div className="import-mapping-row import-mapping-row--export" key={column.id || `${column.source}-${index}`}>
                      <div className="import-mapping-row__controls import-mapping-row__controls--export">
                        <div className="import-mapping-row__control">
                          <label className="app-field__label">Widocznosc</label>
                          <label className="import-export-toggle import-export-toggle--card">
                            <input
                              type="checkbox"
                              checked={column.enabled !== false}
                              onChange={(event) => updateExportColumn(index, { enabled: event.target.checked })}
                            />
                            <span>Aktywna</span>
                          </label>
                        </div>
                        <div className="import-mapping-row__control">
                          <label className="app-field__label">Naglowek eksportu</label>
                          <input
                            className="import-mapping-input"
                            type="text"
                            value={column.header || ""}
                            onChange={(event) => updateExportColumn(index, { header: event.target.value })}
                            placeholder="Naglowek w eksporcie"
                          />
                        </div>
                        <div className="import-mapping-row__control">
                          <label className="app-field__label">Dane z pola</label>
                          <select
                            className="import-mapping-input"
                            value={column.source}
                            onChange={(event) => updateExportColumn(index, { source: event.target.value })}
                          >
                            {entity.exportFields.map((field) => (
                              <option key={field.key} value={field.key}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <div className="app-card" style={{ marginTop: 18 }}>
              <div className="system-status-section-header">
                <div>
                  <h3>Podglad eksportu</h3>
                  <p>Probka pokazuje, jak bedzie wygladal pojedynczy rekord po zastosowaniu aktualnego mapowania.</p>
                </div>
              </div>

              {exportSample.length ? (
                <div className="dashboard-table-scroll">
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th>Naglowek eksportu</th>
                        <th>Przykladowa wartosc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportSample.map((item) => (
                        <tr key={item.header}>
                          <td>{item.header}</td>
                          <td>{String(item.value ?? "-")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="app-empty-state">
                  Brak probki danych dla tej sekcji. Zapis mapowania nadal jest mozliwy, ale test eksportu nie wygeneruje pliku.
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
