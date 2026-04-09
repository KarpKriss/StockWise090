import React, { useEffect, useState } from "react";
import { supabase } from "../../core/api/supabaseClient";

function HistoryList() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error(error);
      alert("Błąd pobierania historii");
      return;
    }

    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  if (loading) {
    return <div className="screen-title">Ładowanie historii...</div>;
  }

  if (!entries.length) {
    return <div className="screen-title">Brak operacji</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <div className="screen-title">Historia operacji</div>

      <div className="confirm-card">
        {entries.map((entry) => {
          const isSurplus = entry.type === "nadwyżka";

          return (
            <div
              key={entry.id}
              className="confirm-row"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                paddingBottom: 10,
                marginBottom: 10,
              }}
            >
              <span>
                {entry.location} | {entry.sku}
              </span>

              <span
                style={{
                  color: isSurplus ? "#4CAF50" : "#F44336",
                  fontWeight: 600,
                }}
              >
                {isSurplus ? "+" : "-"}
                {entry.quantity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default HistoryList;
