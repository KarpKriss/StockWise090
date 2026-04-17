import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, BarChart3, Download, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  fetchDashboardData,
  fetchDashboardExportRows,
  fetchDashboardFilters,
} from "../../core/api/dashboardApi";
import { formatMoney, formatNumber } from "../../core/utils/dashboardMetrics";
import { useAppPreferences } from "../../core/preferences/AppPreferences";
import { exportToCSV } from "../../utils/csvExport";
import "./dashboard.css";

function MetricCard({ label, value, hint }) {
  return (
    <div className="dashboard-card">
      <div className="dashboard-card-label">{label}</div>
      <div className="dashboard-card-value">{value}</div>
      {hint ? <div className="dashboard-card-hint">{hint}</div> : null}
    </div>
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getZoneHealth(zone) {
  const totalLocations = Number(zone?.total_locations || 0);
  const doneLocations = Number(zone?.done_locations || 0);
  const pendingLocations = Number(zone?.pending_locations || 0);
  const activeLocations = Number(zone?.active_locations || 0);
  const problems = Number(zone?.problems_count || 0);
  const shortages = Number(zone?.shortages_count || 0);
  const surpluses = Number(zone?.surpluses_count || 0);

  if (!totalLocations) {
    return {
      score: 100,
      ratio: 1,
      tone: "clear",
      labelKey: "dashboard.healthClear",
      summaryKey: "dashboard.healthEmptySummary",
    };
  }

  const doneRatio = doneLocations / totalLocations;
  const pendingRatio = pendingLocations / totalLocations;
  const activeRatio = activeLocations / totalLocations;
  const issuePressure = (problems * 1.2 + shortages * 0.8 + surpluses * 0.6) / totalLocations;

  const score = clamp(
    Math.round(doneRatio * 100 - pendingRatio * 22 - activeRatio * 10 - issuePressure * 100),
    0,
    100
  );

  if (score >= 92) {
    return {
      score,
      ratio: score / 100,
      tone: "clear",
      labelKey: "dashboard.healthClear",
      summaryKey: "dashboard.healthClearSummary",
    };
  }

  if (score >= 72) {
    return {
      score,
      ratio: score / 100,
      tone: "stable",
      labelKey: "dashboard.healthStable",
      summaryKey: "dashboard.healthStableSummary",
    };
  }

  if (score >= 45) {
    return {
      score,
      ratio: score / 100,
      tone: "watch",
      labelKey: "dashboard.healthWatch",
      summaryKey: "dashboard.healthWatchSummary",
    };
  }

  return {
    score,
    ratio: score / 100,
    tone: "critical",
    labelKey: "dashboard.healthCritical",
    summaryKey: "dashboard.healthCriticalSummary",
  };
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { locale, t } = useAppPreferences();
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
  const [selectedZone, setSelectedZone] = useState(null);

  const monthOptions = useMemo(
    () => [
      { value: "", label: t("dashboard.allMonths") },
      ...Array.from({ length: 12 }, (_, index) => ({
        value: index + 1,
        label: new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2026, index, 1)),
      })),
    ],
    [locale, t]
  );

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
          setError(loadError.message || t("dashboard.loadError"));
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
  }, [year, month, refreshTick, t]);

  const summary = dashboard.summary || {};
  const enhancedZoneStats = useMemo(
    () =>
      (dashboard.zoneStats || []).map((zone) => ({
        ...zone,
        health: getZoneHealth(zone),
      })),
    [dashboard.zoneStats]
  );

  const selectedZoneStats = useMemo(() => {
    if (selectedZone) {
      return enhancedZoneStats.find((zone) => zone.zone === selectedZone) || enhancedZoneStats[0] || null;
    }

    return (
      [...enhancedZoneStats].sort((left, right) => {
        if (left.health.score !== right.health.score) {
          return left.health.score - right.health.score;
        }

        return right.total_locations - left.total_locations;
      })[0] || null
    );
  }, [enhancedZoneStats, selectedZone]);

  useEffect(() => {
    if (!enhancedZoneStats.length) {
      setSelectedZone(null);
      return;
    }

    if (selectedZone && enhancedZoneStats.some((zone) => zone.zone === selectedZone)) {
      return;
    }

    const defaultZone =
      [...enhancedZoneStats].sort((left, right) => {
        if (left.health.score !== right.health.score) {
          return left.health.score - right.health.score;
        }

        return right.total_locations - left.total_locations;
      })[0] || enhancedZoneStats[0];

    setSelectedZone(defaultZone.zone);
  }, [enhancedZoneStats, selectedZone]);

  const handleExport = async () => {
    setExporting(true);

    try {
      const rows = await fetchDashboardExportRows({ year, month });

      exportToCSV({
        data: rows.summaryRows,
        columns: [
          { key: "metric", label: t("dashboard.metric") },
          { key: "value", label: t("dashboard.value") },
        ],
        fileName: `dashboard-summary-${year || "all"}-${month || "all"}.csv`,
      });

      exportToCSV({
        data: rows.financialRows,
        columns: [
          { key: "zone", label: t("dashboard.zone") },
          { key: "shortage_value", label: t("dashboard.shortageValue") },
          { key: "surplus_value", label: t("dashboard.surplusValue") },
          { key: "total_difference_value", label: t("dashboard.totalDifferenceValue") },
        ],
        fileName: `dashboard-finance-${year || "all"}-${month || "all"}.csv`,
      });
    } catch (exportError) {
      console.error("DASHBOARD EXPORT ERROR:", exportError);
      alert(exportError.message || t("dashboard.exportError"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <div className="dashboard-kicker">{t("dashboard.kicker")}</div>
          <h1 className="dashboard-title">
            <BarChart3 size={26} />
            {t("dashboard.title")}
          </h1>
          <p className="dashboard-subtitle">{t("dashboard.subtitle")}</p>
        </div>

        <div className="dashboard-actions">
          <button className="dashboard-secondary-button" onClick={() => navigate("/menu")}>
            {t("common.backToMenu")}
          </button>
          <button
            className="dashboard-secondary-button"
            onClick={() => setRefreshTick((value) => value + 1)}
          >
            <RefreshCw size={16} />
            {t("dashboard.refresh")}
          </button>
          <button className="dashboard-primary-button" disabled={exporting} onClick={handleExport}>
            <Download size={16} />
            {exporting ? t("dashboard.exporting") : t("dashboard.export")}
          </button>
        </div>
      </div>

      <div className="dashboard-filter-bar">
        <label className="dashboard-filter">
          <span>{t("dashboard.year")}</span>
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-filter">
          <span>{t("dashboard.month")}</span>
          <select value={month} onChange={(event) => setMonth(event.target.value)}>
            {monthOptions.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="dashboard-source">
          {t("dashboard.source")}: {" "}
          <strong>{dashboard.source === "rpc" ? t("dashboard.sourceRpc") : t("dashboard.sourceFallback")}</strong>
        </div>
      </div>

      {error ? <div className="dashboard-error">{error}</div> : null}

      {loading ? (
        <div className="dashboard-loading">{t("dashboard.loading")}</div>
      ) : (
        <>
          <div className="dashboard-grid">
            <MetricCard
              label={t("dashboard.checkedLocations")}
              value={formatNumber(summary.checked_locations)}
              hint={t("dashboard.checkedLocationsHint")}
            />
            <MetricCard label={t("dashboard.operationsCount")} value={formatNumber(summary.operations_count)} />
            <MetricCard label={t("dashboard.shortagesCount")} value={formatNumber(summary.shortages_count)} />
            <MetricCard label={t("dashboard.surplusesCount")} value={formatNumber(summary.surpluses_count)} />
            <MetricCard label={t("dashboard.problemsCount")} value={formatNumber(summary.problems_count)} />
            <MetricCard label={t("dashboard.surplusValue")} value={formatMoney(summary.surplus_value)} />
            <MetricCard label={t("dashboard.shortageValue")} value={formatMoney(summary.shortage_value)} />
            <MetricCard
              label={t("dashboard.totalDifferenceValue")}
              value={formatMoney(summary.total_difference_value)}
            />
            <MetricCard
              label={t("dashboard.avgLocationControl")}
              value={`${formatNumber(summary.avg_location_control_minutes, 2)} min`}
            />
            <MetricCard
              label={t("dashboard.locationsPerHour")}
              value={formatNumber(summary.locations_per_hour, 2)}
            />
            <MetricCard
              label={t("dashboard.avgOperationsPerSession")}
              value={formatNumber(summary.avg_operations_per_session, 2)}
            />
            <MetricCard label={t("dashboard.sessionsCount")} value={formatNumber(summary.sessions_count)} />
            <MetricCard
              label={t("dashboard.avgSession")}
              value={`${formatNumber(summary.avg_session_minutes, 2)} min`}
            />
            <MetricCard
              label={t("dashboard.longestSession")}
              value={`${formatNumber(summary.longest_session_minutes, 2)} min`}
            />
          </div>

          <div className="dashboard-table-card">
            <div className="dashboard-table-header">
              <div>
                <h2>{t("dashboard.zoneStatsTitle")}</h2>
                <p>{t("dashboard.zoneStatsSubtitle")}</p>
              </div>
            </div>

            {enhancedZoneStats.length ? (
              <div className="dashboard-zone-experience">
                <div className="dashboard-zone-legend">
                  <div>
                    <h3>{t("dashboard.zoneLegendTitle")}</h3>
                    <p>{t("dashboard.zoneLegendSubtitle")}</p>
                  </div>
                  <div className="dashboard-zone-legend__items">
                    <div className="dashboard-zone-legend__item">
                      <span className="dashboard-zone-legend__swatch dashboard-zone-legend__swatch--clear" />
                      <span>{t("dashboard.zoneLegendClear")}</span>
                    </div>
                    <div className="dashboard-zone-legend__item">
                      <span className="dashboard-zone-legend__swatch dashboard-zone-legend__swatch--stable" />
                      <span>{t("dashboard.zoneLegendStable")}</span>
                    </div>
                    <div className="dashboard-zone-legend__item">
                      <span className="dashboard-zone-legend__swatch dashboard-zone-legend__swatch--watch" />
                      <span>{t("dashboard.zoneLegendWatch")}</span>
                    </div>
                    <div className="dashboard-zone-legend__item">
                      <span className="dashboard-zone-legend__swatch dashboard-zone-legend__swatch--critical" />
                      <span>{t("dashboard.zoneLegendCritical")}</span>
                    </div>
                  </div>
                </div>

                <div className="dashboard-zone-heatmap">
                  {enhancedZoneStats.map((zone, index) => {
                    const isActive = zone.zone === selectedZoneStats?.zone;
                    const flexGrow = Math.max(zone.total_locations || 1, 1);

                    return (
                      <button
                        key={zone.zone}
                        type="button"
                        className={`dashboard-zone-tile dashboard-zone-tile--${zone.health.tone} ${isActive ? "is-active" : ""}`}
                        style={{ flexGrow, animationDelay: `${Math.min(index * 70, 700)}ms` }}
                        onClick={() => setSelectedZone(zone.zone)}
                      >
                        <div className="dashboard-zone-tile__header">
                          <span className="dashboard-zone-tile__zone">{zone.zone}</span>
                          <span className="dashboard-zone-tile__score">{zone.health.score}/100</span>
                        </div>
                        <div className="dashboard-zone-tile__body">
                          <strong>{formatNumber(zone.total_locations)}</strong>
                          <span>loc. | {zone.location_share}% {t("dashboard.zoneShareSuffix")}</span>
                        </div>
                        <div className="dashboard-zone-tile__footer">
                          <span>{t(zone.health.labelKey)}</span>
                          <span>
                            {formatNumber(zone.problems_count)} {t("dashboard.zoneIssueCount")}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedZoneStats ? (
                  <div className="dashboard-zone-detail">
                    <div className="dashboard-zone-detail__hero">
                      <div>
                        <div className="dashboard-zone-detail__eyebrow">{t("dashboard.zoneHealthEyebrow")}</div>
                        <h3>{selectedZoneStats.zone}</h3>
                        <p>{t(selectedZoneStats.health.summaryKey)}</p>
                      </div>
                      <div className={`dashboard-zone-health dashboard-zone-health--${selectedZoneStats.health.tone}`}>
                        <ShieldCheck size={18} />
                        <strong>{selectedZoneStats.health.score}/100</strong>
                        <span>{t(selectedZoneStats.health.labelKey)}</span>
                      </div>
                    </div>

                    <div className="dashboard-zone-detail__grid">
                      <MetricCard
                        label={t("dashboard.zoneTotalLocations")}
                        value={formatNumber(selectedZoneStats.total_locations)}
                        hint={t("dashboard.zoneTotalLocationsHint", { share: selectedZoneStats.location_share })}
                      />
                      <MetricCard
                        label={t("dashboard.zoneDoneLocations")}
                        value={formatNumber(selectedZoneStats.done_locations)}
                        hint={t("dashboard.zoneDoneLocationsHint")}
                      />
                      <MetricCard
                        label={t("dashboard.zonePendingActive")}
                        value={formatNumber(selectedZoneStats.pending_locations + selectedZoneStats.active_locations)}
                        hint={t("dashboard.zonePendingActiveHint")}
                      />
                      <MetricCard
                        label={t("dashboard.problemsCount")}
                        value={formatNumber(selectedZoneStats.problems_count)}
                        hint={t("dashboard.zoneProblemsHint")}
                      />
                      <MetricCard
                        label={t("dashboard.shortagesCount")}
                        value={formatNumber(selectedZoneStats.shortages_count)}
                      />
                      <MetricCard
                        label={t("dashboard.surplusesCount")}
                        value={formatNumber(selectedZoneStats.surpluses_count)}
                      />
                    </div>

                    <div className="dashboard-zone-kpis">
                      <div className="dashboard-zone-kpi">
                        <Activity size={16} />
                        <span>{t("dashboard.zoneCheckedLocations")}</span>
                        <strong>{formatNumber(selectedZoneStats.checked_locations)}</strong>
                      </div>
                      <div className="dashboard-zone-kpi">
                        <BarChart3 size={16} />
                        <span>{t("dashboard.zoneOperations")}</span>
                        <strong>{formatNumber(selectedZoneStats.operations_count)}</strong>
                      </div>
                      <div className="dashboard-zone-kpi">
                        <TriangleAlert size={16} />
                        <span>{t("dashboard.zoneDifferenceValue")}</span>
                        <strong>{formatMoney(selectedZoneStats.total_difference_value)}</strong>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="dashboard-empty">{t("dashboard.noData")}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
