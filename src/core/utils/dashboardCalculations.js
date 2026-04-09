export function buildDashboardSummary(entries = []) {
  return {
    totalEntries: entries.length,
    shortages: entries.filter((entry) => entry.type === "brak").length,
    surpluses: entries.filter((entry) => entry.type === "nadwyżka").length,
  };
}
