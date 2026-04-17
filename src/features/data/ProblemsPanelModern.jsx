import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Eye, ShieldAlert, Unlock } from "lucide-react";
import PageShell from "../../components/layout/PageShell";
import Button from "../../components/ui/Button";
import { fetchProblemRows, resolveProblemCase } from "../../core/api/problemsApi";
import { exportToCSV } from "../../utils/csvExport";
import { useAuth } from "../../core/auth/AppAuth";
import { useAppPreferences } from "../../core/preferences/AppPreferences";

const COPY = {
  pl: {
    manual: "Reczna inwentaryzacja",
    empty: "Kontrola pustych lokalizacji",
    unknownProcess: "Nieznany proces",
    manualHint: "Zgloszenie zostalo utworzone podczas recznej inwentaryzacji.",
    emptyHint: "Zgloszenie zostalo utworzone podczas kontroli pustych lokalizacji.",
    unknownHint: "Dla tego wpisu nie udalo sie jednoznacznie ustalic procesu zrodlowego.",
    loadError: "Blad pobierania problemow",
    releaseError: "Nie udalo sie zwolnic problemu",
    releaseNote: "Zwolnione z panelu Problemy",
    title: "Problemy",
    subtitle: "Osobny rejestr zgloszen z procesow inwentaryzacji. Lokalizacje pozostaja zablokowane do czasu zwolnienia problemu.",
    back: "Powrot do danych",
    export: "Eksport CSV",
    status: "Status",
    open: "Otwarte",
    resolved: "Zwolnione",
    all: "Wszystkie",
    process: "Proces",
    allProcesses: "Wszystkie procesy",
    loading: "Ladowanie problemow...",
    heading: "Otwarte i zamkniete zgloszenia",
    filteredRows: "{{count}} rekordow po zastosowaniu aktualnych filtrow.",
    panel: "Panel problemow",
    date: "Data",
    location: "Lokalizacja",
    zone: "Strefa",
    issueType: "Typ problemu",
    actions: "Akcje",
    missing: "BRAK",
    released: "Zwolniony",
    blocked: "Zablokowany",
    details: "Szczegoly",
    release: "Zwolnij",
    noRows: "Brak problemow spelniajacych filtry.",
    issueDetails: "Szczegoly problemu",
    close: "Zamknij",
    operator: "Operator",
    issueMeaning: "Co oznacza proces?",
    comment: "Komentarz",
    noComment: "Brak dodatkowego komentarza",
    releaseProblem: "Zwolnij problem",
  },
  en: {
    manual: "Manual inventory",
    empty: "Empty location control",
    unknownProcess: "Unknown process",
    manualHint: "The issue was created during manual inventory.",
    emptyHint: "The issue was created during empty-location control.",
    unknownHint: "The source process could not be identified for this record.",
    loadError: "Could not load problems",
    releaseError: "Could not release the problem",
    releaseNote: "Released from Problems panel",
    title: "Problems",
    subtitle: "Dedicated register of inventory-process issues. Locations stay blocked until the problem is released.",
    back: "Back to data",
    export: "Export CSV",
    status: "Status",
    open: "Open",
    resolved: "Released",
    all: "All",
    process: "Process",
    allProcesses: "All processes",
    loading: "Loading problems...",
    heading: "Open and released issues",
    filteredRows: "{{count}} records after applying the current filters.",
    panel: "Problems panel",
    date: "Date",
    location: "Location",
    zone: "Zone",
    issueType: "Issue type",
    actions: "Actions",
    missing: "MISSING",
    released: "Released",
    blocked: "Blocked",
    details: "Details",
    release: "Release",
    noRows: "No problems match the current filters.",
    issueDetails: "Problem details",
    close: "Close",
    operator: "Operator",
    issueMeaning: "What does this process mean?",
    comment: "Comment",
    noComment: "No additional comment",
    releaseProblem: "Release problem",
  },
  de: {
    manual: "Manuelle Inventur",
    empty: "Kontrolle leerer Lokationen",
    unknownProcess: "Unbekannter Prozess",
    manualHint: "Die Meldung wurde wahrend der manuellen Inventur erstellt.",
    emptyHint: "Die Meldung wurde wahrend der Kontrolle leerer Lokationen erstellt.",
    unknownHint: "Der Quellprozess konnte fur diesen Eintrag nicht eindeutig bestimmt werden.",
    loadError: "Probleme konnten nicht geladen werden",
    releaseError: "Das Problem konnte nicht freigegeben werden",
    releaseNote: "Aus dem Probleme-Panel freigegeben",
    title: "Probleme",
    subtitle: "Eigenes Register fur Meldungen aus Inventurprozessen. Lokationen bleiben blockiert, bis das Problem freigegeben wird.",
    back: "Zuruck zu den Daten",
    export: "CSV exportieren",
    status: "Status",
    open: "Offen",
    resolved: "Freigegeben",
    all: "Alle",
    process: "Prozess",
    allProcesses: "Alle Prozesse",
    loading: "Probleme werden geladen...",
    heading: "Offene und geschlossene Meldungen",
    filteredRows: "{{count}} Eintrage nach Anwendung der aktuellen Filter.",
    panel: "Probleme-Panel",
    date: "Datum",
    location: "Lokation",
    zone: "Zone",
    issueType: "Problemtyp",
    actions: "Aktionen",
    missing: "FEHLT",
    released: "Freigegeben",
    blocked: "Blockiert",
    details: "Details",
    release: "Freigeben",
    noRows: "Keine Probleme entsprechen den aktuellen Filtern.",
    issueDetails: "Problemdetails",
    close: "Schliessen",
    operator: "Operator",
    issueMeaning: "Was bedeutet dieser Prozess?",
    comment: "Kommentar",
    noComment: "Kein zusatzlicher Kommentar",
    releaseProblem: "Problem freigeben",
  },
};

function formatDate(value, locale) {
  return value ? new Date(value).toLocaleString(locale) : "-";
}

export default function ProblemsPanelModern() {
  const { user } = useAuth();
  const { language, locale } = useAppPreferences();
  const copy = COPY[language] || COPY.pl;
  const [rows, setRows] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("open");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedRow, setSelectedRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function sourceLabel(value) {
    if (value === "manual_inventory") return copy.manual;
    if (value === "empty_location") return copy.empty;
    return copy.unknownProcess;
  }

  function sourceHint(value) {
    if (value === "manual_inventory") return copy.manualHint;
    if (value === "empty_location") return copy.emptyHint;
    return copy.unknownHint;
  }

  async function loadRows() {
    try {
      setLoading(true);
      setRows(await fetchProblemRows(user?.site_id));
      setError("");
    } catch (err) {
      setError(err.message || copy.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [user?.site_id]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const status = String(row.status || "open").toLowerCase();
      const source = String(row.source_process || "").toLowerCase();
      const matchesStatus =
        selectedStatus === "all" ? true : selectedStatus === "open" ? status !== "resolved" : status === "resolved";
      const matchesSource = selectedSource === "all" || source === selectedSource;
      return matchesStatus && matchesSource;
    });
  }, [rows, selectedSource, selectedStatus]);

  const sources = [...new Set(rows.map((row) => row.source_process).filter(Boolean))];

  async function handleResolve(row) {
    try {
      setSubmitting(true);
      await resolveProblemCase({
        issueId: row.id,
        locationId: row.location_id,
        releaseNote: copy.releaseNote,
      });
      await loadRows();
    } catch (err) {
      setError(err.message || copy.releaseError);
    } finally {
      setSubmitting(false);
    }
  }

  const exportRows = filteredRows.map((row) => ({
    ...row,
    source_process: sourceLabel(row.source_process),
    created_at: formatDate(row.created_at, locale),
    resolved_at: formatDate(row.resolved_at, locale),
  }));

  return (
    <PageShell
      title={copy.title}
      subtitle={copy.subtitle}
      icon={<ShieldAlert size={26} />}
      backTo="/data"
      backLabel={copy.back}
      actions={
        <Button
          variant="secondary"
          onClick={() =>
            exportToCSV({
              data: exportRows,
              columns: [
                { key: "created_at", label: copy.date },
                { key: "location_code", label: copy.location },
                { key: "zone", label: copy.zone },
                { key: "issue_type", label: copy.issueType },
                { key: "source_process", label: copy.process },
                { key: "status", label: copy.status },
                { key: "note", label: copy.comment },
              ],
              fileName: "problems.csv",
            })
          }
        >
          <Download size={16} />
          {copy.export}
        </Button>
      }
    >
      <div className="app-card history-toolbar-card">
        <div className="history-toolbar-row">
          <div className="app-field">
            <label className="app-field__label">{copy.status}</label>
            <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
              <option value="open">{copy.open}</option>
              <option value="resolved">{copy.resolved}</option>
              <option value="all">{copy.all}</option>
            </select>
          </div>

          <div className="app-field">
            <label className="app-field__label">{copy.process}</label>
            <select value={selectedSource} onChange={(event) => setSelectedSource(event.target.value)}>
              <option value="all">{copy.allProcesses}</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {sourceLabel(source)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? <div className="app-card">{copy.loading}</div> : null}
      {error ? <div className="input-error-text">{error}</div> : null}

      {!loading && !error ? (
        <div className="app-card">
          <div className="app-module-panel__header" style={{ marginBottom: 14 }}>
            <div>
              <h2 className="process-panel__title" style={{ fontSize: 24 }}>{copy.heading}</h2>
              <p className="process-panel__subtitle">
                {copy.filteredRows.replace("{{count}}", String(filteredRows.length))}
              </p>
            </div>
            <span className="history-status-chip">
              <AlertTriangle size={14} style={{ marginRight: 6 }} />
              {copy.panel}
            </span>
          </div>

          <div className="dashboard-table-scroll">
            <table className="app-table">
              <thead>
                <tr>
                  <th>{copy.date}</th>
                  <th>{copy.location}</th>
                  <th>{copy.zone}</th>
                  <th>{copy.issueType}</th>
                  <th>{copy.process}</th>
                  <th>{copy.status}</th>
                  <th>{copy.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isResolved = String(row.status || "").toLowerCase() === "resolved";

                  return (
                    <tr key={row.id}>
                      <td>{formatDate(row.created_at, locale)}</td>
                      <td>{row.location_code || copy.missing}</td>
                      <td>{row.zone || "-"}</td>
                      <td>{row.issue_type || "-"}</td>
                      <td>{sourceLabel(row.source_process)}</td>
                      <td>
                        <span className={`status-badge ${isResolved ? "status-badge--active" : "status-badge--paused"}`}>
                          {isResolved ? copy.released : copy.blocked}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Button variant="secondary" size="md" onClick={() => setSelectedRow(row)}>
                            <Eye size={16} />
                            {copy.details}
                          </Button>
                          {!isResolved ? (
                            <Button variant="secondary" size="md" loading={submitting} onClick={() => handleResolve(row)}>
                              <Unlock size={16} />
                              {copy.release}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="app-empty-state">
                      {copy.noRows}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {selectedRow ? (
        <div className="history-modal-overlay" onClick={() => setSelectedRow(null)}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <div className="history-modal__header">
              <div>
                <h2 className="process-panel__title" style={{ fontSize: 26, margin: 0 }}>
                  {copy.issueDetails}
                </h2>
                <p className="process-panel__subtitle">
                  {formatDate(selectedRow.created_at, locale)} - {sourceLabel(selectedRow.source_process)}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setSelectedRow(null)}>
                {copy.close}
              </Button>
            </div>

            <div className="process-meta-grid" style={{ marginBottom: 18 }}>
              <div className="process-meta-item">
                <div className="process-meta-item__label">{copy.location}</div>
                <div className="process-meta-item__value">{selectedRow.location_code || copy.missing}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">{copy.status}</div>
                <div className="process-meta-item__value">{selectedRow.status || "open"}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">{copy.issueType}</div>
                <div className="process-meta-item__value">{selectedRow.issue_type || "-"}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">{copy.process}</div>
                <div className="process-meta-item__value">{sourceLabel(selectedRow.source_process)}</div>
              </div>
              <div className="process-meta-item">
                <div className="process-meta-item__label">{copy.operator}</div>
                <div className="process-meta-item__value">{selectedRow.operator_email || selectedRow.user_id || copy.missing}</div>
              </div>
            </div>

            <div className="process-section-card" style={{ marginBottom: 18 }}>
              <h3 className="process-section-card__title">{copy.issueMeaning}</h3>
              <p className="process-panel__subtitle" style={{ margin: 0 }}>
                {sourceHint(selectedRow.source_process)}
              </p>
            </div>

            <div className="process-section-card">
              <h3 className="process-section-card__title">{copy.comment}</h3>
              <pre className="history-modal__pre">{selectedRow.note || copy.noComment}</pre>
            </div>

            {String(selectedRow.status || "").toLowerCase() !== "resolved" ? (
              <div className="process-actions" style={{ marginTop: 18 }}>
                <Button size="lg" loading={submitting} onClick={() => handleResolve(selectedRow)}>
                  <CheckCircle2 size={16} />
                  {copy.releaseProblem}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
