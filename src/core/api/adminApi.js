import { supabase } from "./supabaseClient";

export async function fetchUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Błąd pobierania użytkowników");
  }

  return data;
}

export async function createAdminUser(payload) {
  const { data, error } = await supabase
    .from("users")
    .insert([payload])
    .select();

  if (error) {
    console.error(error);
    throw new Error("Błąd tworzenia użytkownika");
  }

  return data;
}

export async function updateUser(id, payload) {
  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("id", id)
    .select();

  if (error) {
    console.error(error);
    throw new Error("Błąd aktualizacji użytkownika");
  }

  return data;
}

export async function resetUserPassword(id, newPassword) {
  const { error } = await supabase.auth.admin.updateUserById(id, {
    password: newPassword,
  });

  if (error) {
    console.error(error);
    throw new Error("Błąd resetu hasła");
  }

  return { success: true };
}

export async function fetchSystemStatus() {
  const { data, error } = await supabase
    .from("system_status")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    console.error(error);
    throw new Error("Błąd pobierania statusu systemu");
  }

  return data;
}

export async function insertLocations(rows) {
  const { error } = await supabase
    .from("locations")
    .insert(rows);

  if (error) {
    console.error("INSERT ERROR:", error);
throw error;
  }
}

export async function clearLocations() {
  const { data, error } = await supabase
    .from("locations")
    .delete()
    .not("id", "is", null)
    .select();

  console.log("DELETE RESULT:", data);
  console.log("DELETE ERROR:", error);

  if (error) {
    throw error;
  }
}

export async function addLocation(row) {
  const { error } = await supabase
    .from("locations")
    .insert([row]);

  if (error) {
    throw new Error("Błąd dodawania lokalizacji");
  }
}
