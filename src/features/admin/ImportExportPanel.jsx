import {
  ArrowLeftRight,
  Boxes,
  FileCog,
  History,
  MapPinned,
  Package,
  Save,
  Tag,
  Warehouse,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/layout/PageShell";
import Button from "../../components/ui/Button";
import { useAuth } from "../../core/auth/AppAuth";
import { fetchImportExportMapping, saveImportExportMapping } from "../../core/api/importExportConfigApi";
import {
  getDefaultImportExportMapping,
  IMPORT_EXPORT_ENTITIES,
} from "../../core/config/importExportDefaults";
import { getEntityDefinition, mergeImportExportMapping } from "../../core/utils/importExportMapping";

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

  useEffect(() => {
    async function loadMapping() {
      try {
        setLoading(true);
        const next = await fetchImportExportMapping(user?.site_id || null);
        setMapping(mergeImportExportMapping(next));
        setError("");
      } catch (err) {
        setError(err.message || "Nie udalo sie pobrac konfiguracji mapowania");
      } finally {
        setLoading(false);
      }
    }

    loadMapping();
  }, [user?.site_id]);

  const entity = getEntityDefinition(selectedEntity);
  const entityMapping = useMemo(() => mergeImportExportMapping(mapping).entities[selectedEntity], [mapping, selectedEntity]);

  function updateImportField(fieldKey, patch) {
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
      const saved = await saveImportExportMapping(user?.site_id || null, mapping);
      setMapping(mergeImportExportMapping(saved));
      setError("");
    } catch (err) {
      setError(err.message || "Nie udalo sie zapisac konfiguracji");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      title="Import / Export"
      subtitle="Mapuj kolumny wejsciowe i naglowki eksportu dla danych referencyjnych bez zmian w kodzie."
      icon={<ArrowLeftRight size={26} />}
      backTo="/admin"
      backLabel="Powrot do ustawien"
      compact
      actions={
        <>
          <Button variant="secondary" onClick={resetSelectedEntity}>
            Przywroc domyslne
          </Button>
          <Button loading={saving} onClick={handleSave}>
            <Save size={16} />
            Zapisz mapowanie
          </Button>
        </>
      }
    >
      {error ? <div className="input-error-text">{error}</div> : null}
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

            <div className="history-modal__grid import-config-layout">
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
                        <div className="import-mapping-row" key={field.key}>
                          <div>
                            <div className="import-mapping-row__title">{field.label}</div>
                            <div className="helper-note">
                              {field.required ? "Pole wymagane" : "Pole opcjonalne"}
                            </div>
                          </div>
                          <select
                            value={fieldConfig.mode}
                            onChange={(event) => updateImportField(field.key, { mode: event.target.value })}
                          >
                            <option value="header">Naglowek</option>
                            <option value="index">Numer kolumny</option>
                          </select>
                          <input
                            type={fieldConfig.mode === "index" ? "number" : "text"}
                            min={1}
                            value={fieldConfig.value || ""}
                            onChange={(event) => updateImportField(field.key, { value: event.target.value })}
                            placeholder={fieldConfig.mode === "index" ? "Np. 4" : "Np. sku albo ilosc"}
                          />
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
                      <label className="import-export-toggle">
                        <input
                          type="checkbox"
                          checked={column.enabled !== false}
                          onChange={(event) => updateExportColumn(index, { enabled: event.target.checked })}
                        />
                        <span>Aktywna</span>
                      </label>
                      <input
                        type="text"
                        value={column.header || ""}
                        onChange={(event) => updateExportColumn(index, { header: event.target.value })}
                        placeholder="Naglowek w eksporcie"
                      />
                      <select
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
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
