import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import {
  fetchDashboardData,
  fetchDashboardExportRows,
  fetchDashboardFilters,
} from "../../core/api/dashboardApi";
import { formatMoney, formatNumber } from "../../core/utils/dashboardMetrics";
import { exportToCSV } from "../../utils/csvExport";
import "./dashboard.css";

const MONTH_OPTIONS = [
  { value: "", label: "Wszystkie miesiace" },
  { value: 1, label: "Styczen" },
  { value: 2, label: "Luty" },
  { value: 3, label: "Marzec" },
  { value: 4, label: "Kwiecien" },
  { value: 5, label: "Maj" },
  { value: 6, label: "Czerwiec" },
  { value: 7, label: "Lipiec" },
  { value: 8, label: "Sierpien" },
  { value: 9, label: "Wrzesien" },
  { value: 10, label: "Pazdziernik" },
  { value: 11, label: "Listopad" },
  { value: 12, label: "Grudzien" },
];

function MetricCard({ label, value, hint }) {
  return (
    <div className="dashboard-card">
      <div className="dashboard-card-label">{label}</div>
      <div className="dashboard-card-value">{value}</div>
      {hint ? <div className="dashboard-card-hint">{hint}</div> : null}
    </div>
  );
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState("");
  const [years, setYears] = useState([currentYear]);
  const [dashboard, setDashboard] = useState({
    summary: {},
    zoneStats: [],
    source: "fallback",
  });
  const [refreshTick, setRefreshTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchDashboardFilters()
      .then((result) => {
        if (cancelled) return;
        const nextYears = result.years?.length ? result.years : [currentYear];
        setYears(nextYears);
        if (!nextYears.includes(currentYear)) {
          setYear(nextYears[0]);
        }
      })
      .catch((filtersError) => {
        console.warn("DASHBOARD FILTERS ERROR:", filtersError);
      });

    return () => {
      cancelled = true;
    };
  }, [currentYear]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const data = await fetchDashboardData({ year, month });
        if (!cancelled) {
          setDashboard(data);
        }
      } catch (loadError) {
        console.error("DASHBOARD LOAD ERROR:", loadError);
        if (!cancelled) {
          setError(loadError.message || "Nie udalo sie pobrac statystyk");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [year, month, refreshTick]);

  const summary = dashboard.summary || {};

  const handleExport = async () => {
    setExporting(true);

    try {
      const rows = await fetchDashboardExportRows({ year, month });

      exportToCSV({
        data: rows.summaryRows,
        columns: [
          { key: "metric", label: "Metryka" },
          { key: "value", label: "Wartosc" },
        ],
        fileName: `dashboard-summary-${year || "all"}-${month || "all"}.csv`,
      });

      exportToCSV({
        data: rows.financialRows,
        columns: [
          { key: "zone", label: "Strefa" },
          { key: "shortage_value", label: "Wartosc brakow" },
          { key: "surplus_value", label: "Wartosc nadwyzek" },
          { key: "total_difference_value", label: "Laczna wartosc roznic" },
        ],
        fileName: `dashboard-finance-${year || "all"}-${month || "all"}.csv`,
      });
    } catch (exportError) {
      console.error("DASHBOARD EXPORT ERROR:", exportError);
      alert(exportError.message || "Nie udalo sie wyeksportowac statystyk");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <div className="dashboard-kicker">Panel statystyk</div>
          <h1 className="dashboard-title">
            <BarChart3 size={26} />
            Dashboard statystyk
          </h1>
          <p className="dashboard-subtitle">
            Podsumowanie pracy operacyjnej, finansowej i sesyjnej dla wybranego okresu.
          </p>
        </div>

        <div className="dashboard-actions">
          <button className="dashboard-secondary-button" onClick={() => navigate("/menu")}>
            Powrot do menu
          </button>
          <button
            className="dashboard-secondary-button"
            onClick={() => setRefreshTick((value) => value + 1)}
          >
            <RefreshCw size={16} />
            Odswiez
          </button>
          <button
            className="dashboard-primary-button"
            disabled={exporting}
            onClick={handleExport}
          >
            <Download size={16} />
            {exporting ? "Eksport..." : "Eksport CSV"}
          </button>
        </div>
      </div>

      <div className="dashboard-filter-bar">
        <label className="dashboard-filter">
          <span>Rok</span>
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-filter">
          <span>Miesiac</span>
          <select value={month} onChange={(event) => setMonth(event.target.value)}>
            {MONTH_OPTIONS.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="dashboard-source">
          Zrodlo danych: <strong>{dashboard.source === "rpc" ? "backend RPC" : "frontend fallback"}</strong>
        </div>
      </div>

      {error ? <div className="dashboard-error">{error}</div> : null}

      {loading ? (
        <div className="dashboard-loading">Pobieram statystyki...</div>
      ) : (
        <>
          <div className="dashboard-grid">
            <MetricCard
              label="Sprawdzone lokalizacje"
              value={formatNumber(summary.checked_locations)}
              hint="Liczba unikalnych lokalizacji z wpisami w okresie"
            />
            <MetricCard label="Liczba operacji" value={formatNumber(summary.operations_count)} />
            <MetricCard label="Braki" value={formatNumber(summary.shortages_count)} />
            <MetricCard label="Nadwyzki" value={formatNumber(summary.surpluses_count)} />
            <MetricCard label="Zgloszone problemy" value={formatNumber(summary.problems_count)} />
            <MetricCard label="Wartosc nadwyzek" value={formatMoney(summary.surplus_value)} />
            <MetricCard label="Wartosc brakow" value={formatMoney(summary.shortage_value)} />
            <MetricCard
              label="Laczna wartosc roznic"
              value={formatMoney(summary.total_difference_value)}
            />
            <MetricCard
              label="Sredni czas kontroli lokalizacji"
              value={`${formatNumber(summary.avg_location_control_minutes, 2)} min`}
            />
            <MetricCard
              label="Lokalizacje na godzine"
              value={formatNumber(summary.locations_per_hour, 2)}
            />
            <MetricCard
              label="Srednia operacji na sesje"
              value={formatNumber(summary.avg_operations_per_session, 2)}
            />
            <MetricCard label="Liczba sesji" value={formatNumber(summary.sessions_count)} />
            <MetricCard
              label="Sredni czas sesji"
              value={`${formatNumber(summary.avg_session_minutes, 2)} min`}
            />
            <MetricCard
              label="Najdluzsza sesja"
              value={`${formatNumber(summary.longest_session_minutes, 2)} min`}
            />
          </div>

          <div className="dashboard-table-card">
            <div className="dashboard-table-header">
              <div>
                <h2>Statystyki per strefa</h2>
                <p>Rozbicie wynikow na strefy magazynowe dla aktualnie wybranego okresu.</p>
              </div>
            </div>

            <div className="dashboard-table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Strefa</th>
                    <th>Sprawdzone lokalizacje</th>
                    <th>Operacje</th>
                    <th>Braki</th>
                    <th>Nadwyzki</th>
                    <th>Problemy</th>
                    <th>Wartosc brakow</th>
                    <th>Wartosc nadwyzek</th>
                    <th>Laczna wartosc roznic</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.zoneStats?.length ? (
                    dashboard.zoneStats.map((row) => (
                      <tr key={row.zone}>
                        <td>{row.zone}</td>
                        <td>{formatNumber(row.checked_locations)}</td>
                        <td>{formatNumber(row.operations_count)}</td>
                        <td>{formatNumber(row.shortages_count)}</td>
                        <td>{formatNumber(row.surpluses_count)}</td>
                        <td>{formatNumber(row.problems_count)}</td>
                        <td>{formatMoney(row.shortage_value)}</td>
                        <td>{formatMoney(row.surplus_value)}</td>
                        <td>{formatMoney(row.total_difference_value)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="dashboard-empty">
                        Brak danych dla wybranego okresu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
