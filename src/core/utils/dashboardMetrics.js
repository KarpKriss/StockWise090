function normalizeType(type) {
  const normalized = String(type || "").trim().toLowerCase();

  if (["surplus", "nadwyzka", "nadwy\u017cka"].includes(normalized)) {
    return "surplus";
  }

  if (["shortage", "brak"].includes(normalized)) {
    return "shortage";
  }

  if (normalized === "checked_empty") {
    return "checked_empty";
  }

  if (normalized === "problem") {
    return "problem";
  }

  return normalized;
}

function toDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function matchesPeriod(date, year, month) {
  if (!date) {
    return false;
  }

  if (year && date.getFullYear() !== Number(year)) {
    return false;
  }

  if (month && date.getMonth() + 1 !== Number(month)) {
    return false;
  }

  return true;
}

function round(value, digits = 2) {
  const number = Number(value || 0);
  return Number(number.toFixed(digits));
}

function durationMs(start, end) {
  const from = toDate(start);
  const to = toDate(end);

  if (!from || !to) {
    return 0;
  }

  return Math.max(0, to.getTime() - from.getTime());
}

export function formatMoney(value) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

export function buildPriceMap(priceRows = []) {
  return Object.fromEntries(
    (priceRows || []).map((row) => [String(row.sku || "").trim(), Number(row.price || 0)])
  );
}

export function collectDashboardYears({
  entries = [],
  sessions = [],
  issues = [],
} = {}) {
  const years = new Set();

  [...entries, ...issues].forEach((row) => {
    const date = toDate(row.timestamp || row.created_at);
    if (date) {
      years.add(date.getFullYear());
    }
  });

  sessions.forEach((session) => {
    const date = toDate(session.started_at || session.created_at);
    if (date) {
      years.add(date.getFullYear());
    }
  });

  if (!years.size) {
    years.add(new Date().getFullYear());
  }

  return [...years].sort((left, right) => right - left);
}

export function buildDashboardData({
  entries = [],
  sessions = [],
  locations = [],
  issues = [],
  priceRows = [],
  year = null,
  month = null,
} = {}) {
  const priceMap = buildPriceMap(priceRows);
  const locationZoneMap = Object.fromEntries(
    (locations || []).map((row) => [String(row.code || "").trim(), String(row.zone || "").trim()])
  );

  const filteredEntries = (entries || []).filter((entry) =>
    matchesPeriod(toDate(entry.timestamp || entry.created_at), year, month)
  );

  const filteredSessions = (sessions || []).filter((session) =>
    matchesPeriod(toDate(session.started_at || session.created_at), year, month)
  );

  const filteredIssues = (issues || []).filter((issue) =>
    matchesPeriod(toDate(issue.created_at), year, month)
  );

  const checkedLocationSet = new Set(
    filteredEntries.map((entry) => String(entry.location || "").trim()).filter(Boolean)
  );

  const shortages = filteredEntries.filter(
    (entry) => normalizeType(entry.type) === "shortage"
  );
  const surpluses = filteredEntries.filter(
    (entry) => normalizeType(entry.type) === "surplus"
  );
  const problemEntries = filteredEntries.filter(
    (entry) => normalizeType(entry.type) === "problem"
  );

  const shortageValue = shortages.reduce((sum, entry) => {
    const price = priceMap[String(entry.sku || "").trim()] || 0;
    return sum + Number(entry.quantity || 0) * price;
  }, 0);

  const surplusValue = surpluses.reduce((sum, entry) => {
    const price = priceMap[String(entry.sku || "").trim()] || 0;
    return sum + Number(entry.quantity || 0) * price;
  }, 0);

  const groupedByLocationSession = filteredEntries.reduce((accumulator, entry) => {
    const location = String(entry.location || "").trim();
    if (!location) {
      return accumulator;
    }

    const key = `${entry.session_id || "no-session"}::${location}`;
    const timestamp = toDate(entry.timestamp || entry.created_at);

    if (!timestamp) {
      return accumulator;
    }

    if (!accumulator.has(key)) {
      accumulator.set(key, {
        start: timestamp,
        end: timestamp,
      });
      return accumulator;
    }

    const current = accumulator.get(key);
    if (timestamp < current.start) current.start = timestamp;
    if (timestamp > current.end) current.end = timestamp;
    return accumulator;
  }, new Map());

  const locationDurations = [...groupedByLocationSession.values()].map((row) =>
    Math.max(0, row.end.getTime() - row.start.getTime())
  );

  const sessionDurations = filteredSessions.map((session) =>
    durationMs(
      session.started_at || session.created_at,
      session.ended_at || session.last_activity || session.started_at || session.created_at
    )
  );

  const totalSessionHours =
    sessionDurations.reduce((sum, value) => sum + value, 0) / (1000 * 60 * 60);

  const zoneBucket = new Map();

  const ensureZone = (zone) => {
    const safeZone = String(zone || "Nieprzypisana").trim() || "Nieprzypisana";

    if (!zoneBucket.has(safeZone)) {
      zoneBucket.set(safeZone, {
        zone: safeZone,
        operations_count: 0,
        shortages_count: 0,
        surpluses_count: 0,
        problems_count: 0,
        shortage_value: 0,
        surplus_value: 0,
        _locations: new Set(),
      });
    }

    return zoneBucket.get(safeZone);
  };

  filteredEntries.forEach((entry) => {
    const zone = locationZoneMap[String(entry.location || "").trim()] || "Nieprzypisana";
    const bucket = ensureZone(zone);
    const normalizedType = normalizeType(entry.type);

    bucket.operations_count += 1;
    if (entry.location) {
      bucket._locations.add(String(entry.location).trim());
    }

    if (normalizedType === "shortage") {
      bucket.shortages_count += 1;
      bucket.shortage_value +=
        Number(entry.quantity || 0) * (priceMap[String(entry.sku || "").trim()] || 0);
    }

    if (normalizedType === "surplus") {
      bucket.surpluses_count += 1;
      bucket.surplus_value +=
        Number(entry.quantity || 0) * (priceMap[String(entry.sku || "").trim()] || 0);
    }

    if (normalizedType === "problem") {
      bucket.problems_count += 1;
    }
  });

  filteredIssues.forEach((issue) => {
    const bucket = ensureZone(issue.zone || "Nieprzypisana");
    bucket.problems_count += 1;
  });

  const zoneStats = [...zoneBucket.values()]
    .map((row) => ({
      zone: row.zone,
      checked_locations: row._locations.size,
      operations_count: row.operations_count,
      shortages_count: row.shortages_count,
      surpluses_count: row.surpluses_count,
      problems_count: row.problems_count,
      shortage_value: round(row.shortage_value),
      surplus_value: round(row.surplus_value),
      total_difference_value: round(row.shortage_value + row.surplus_value),
    }))
    .sort((left, right) => left.zone.localeCompare(right.zone));

  return {
    summary: {
      checked_locations: checkedLocationSet.size,
      operations_count: filteredEntries.length,
      shortages_count: shortages.length,
      surpluses_count: surpluses.length,
      problems_count: filteredIssues.length + problemEntries.length,
      shortage_value: round(shortageValue),
      surplus_value: round(surplusValue),
      total_difference_value: round(shortageValue + surplusValue),
      avg_location_control_minutes: round(
        locationDurations.length
          ? locationDurations.reduce((sum, value) => sum + value, 0) /
              locationDurations.length /
              (1000 * 60)
          : 0
      ),
      locations_per_hour: round(
        totalSessionHours > 0 ? checkedLocationSet.size / totalSessionHours : 0
      ),
      avg_operations_per_session: round(
        filteredSessions.length ? filteredEntries.length / filteredSessions.length : 0
      ),
      sessions_count: filteredSessions.length,
      avg_session_minutes: round(
        sessionDurations.length
          ? sessionDurations.reduce((sum, value) => sum + value, 0) /
              sessionDurations.length /
              (1000 * 60)
          : 0
      ),
      longest_session_minutes: round(
        sessionDurations.length ? Math.max(...sessionDurations) / (1000 * 60) : 0
      ),
    },
    zoneStats,
  };
}
