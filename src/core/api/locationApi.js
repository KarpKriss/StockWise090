import { supabase } from "./supabaseClient";

export const fetchLocations = async ({
  page = 1,
  limit = 50,
  search = "",
  zone = "all",
  sortKey = "code",
  sortOrder = "asc"
} = {}) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("locations")
    .select("*", { count: "exact" });

  // 🔍 SEARCH
  if (search) {
    query = query.ilike("code", `%${search}%`);
  }

  // 🟦 FILTER ZONE
  if (zone !== "all") {
    query = query.eq("zone", zone);
  }

  // 🔽 SORT
  if (sortKey) {
    query = query.order(sortKey, { ascending: sortOrder === "asc" });
  }

  // 📦 PAGINATION
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    data,
    count
  };
};

export async function exportLocations() {
  const { data, error } = await supabase
    .from("locations")
    .select("code, zone, status");

  if (error) {
    console.error(error);
    throw new Error("Błąd eksportu mapy");
  }

  return data;
}

export const addLocation = async ({ code, zone, status = "active" }) => {
  const { error } = await supabase
    .from("locations")
    .insert([
      {
        code,
        zone,
        status
      }
    ]);

  if (error) {
    throw new Error(error.message);
  }
};
