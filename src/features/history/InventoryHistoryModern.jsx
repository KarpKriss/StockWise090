import React, { useEffect, useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { supabase } from "../../core/api/supabaseClient";
import PageShell from "../../components/layout/PageShell";

function normalizeType(type) {
  const normalized = String(type || "").toLowerCase();

  if (normalized === "nadwyżka" || normalized === "nadwyzka" || normalized === "surplus") {
    return { label: "Nadwyzka", tone: "success", prefix: "+" };
  }

  if (normalized === "brak" || normalized === "shortage") {
    return { label: "Brak", tone: "danger", prefix: "-" };
  }

  if (normalized === "checked_empty") {
    return { label: "Pusta lokalizacja", tone: "neutral", prefix: "" };
  }

  return { label: type || "Operacja", tone: "neutral", prefix: "" };
}

export default function InventoryHistoryModern() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchHistory() {
      const { data, error: fetchError } = await supabase
        .from("entries")
        .select("*")
        .in("type", ["brak", "nadwyżka", "nadwyzka", "surplus", "shortage", "checked_empty"])
        .order("created_at", { ascending: false })
        .limit(200);

      if (fetchError) {
        console.error("HISTORY FETCH ERROR:", fetchError);
        setError("Blad pobierania historii");
      } else {
        setEntries(data || []);
      }

      setLoading(false);
    }

    fetchHistory();
  }, []);

  const filteredEntries = useMemo(() => {
    const needle = search.trim().toLowerCase();

    if (!needle) {
      return entries;
    }

    return entries.filter((entry) =>
      [entry.location, entry.sku, entry.ean, entry.lot, entry.operator, entry.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [entries, search]);

  return (
    <PageShell
      title="Historia operacji"
      subtitle="Przegladaj zapisane wyniki inwentaryzacji, nadwyzki i puste lokalizacje."
      icon={<History size={26} />}
      backTo="/menu"
    >
      <div className="app-card">
        <div className="app-field">
          <label className="app-field__label">Szukaj operacji</label>
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--app-text-soft)" }}
            />
            <input
              className="app-input"
              placeholder="Lokalizacja, SKU, EAN, lot lub operator"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
        </div>
      </div>

      {loading ? <div className="app-card">Ladowanie historii...</div> : null}
      {error ? <div className="app-card">{error}</div> : null}

      {!loading && !error ? (
        <div className="confirm-card">
          {filteredEntries.length ? (
            filteredEntries.map((entry) => {
              const typeMeta = normalizeType(entry.type);

              return (
                <div
                  key={entry.id}
                  className="confirm-row"
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid rgba(84, 98, 140, 0.12)",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {entry.location || "-"} | {entry.sku || "-"}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--app-text-soft)", marginTop: 4 }}>
                      {typeMeta.label} | {entry.operator || "BRAK"} |{" "}
                      {new Date(entry.created_at || entry.timestamp).toLocaleString()}
                    </div>
                    {entry.lot ? (
                      <div style={{ fontSize: 13, color: "var(--app-text-soft)", marginTop: 4 }}>
                        LOT: {entry.lot}
                      </div>
                    ) : null}
                    {entry.ean ? (
                      <div style={{ fontSize: 13, color: "var(--app-text-soft)", marginTop: 4 }}>
                        EAN: {entry.ean}
                      </div>
                    ) : null}
                  </div>

                  <span
                    style={{
                      color:
                        typeMeta.tone === "success"
                          ? "var(--app-success)"
                          : typeMeta.tone === "danger"
                            ? "var(--app-danger)"
                            : "var(--app-primary-strong)",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {typeMeta.prefix}
                    {entry.quantity ?? 0}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="app-empty-state">Brak operacji inwentaryzacyjnych</div>
          )}
        </div>
      ) : null}
    </PageShell>
  );
}
