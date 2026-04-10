import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "./supabaseClient";

function normalizeRole(role) {
  return String(role || "user").toLowerCase();
}

function normalizeStatus(status) {
  return String(status || "inactive").toLowerCase();
}

function getLastActivityTimestamp(session) {
  return (
    session?.last_activity ||
    session?.ended_at ||
    session?.started_at ||
    session?.created_at ||
    null
  );
}

export async function fetchAdminUsersList() {
  const [profilesResult, sessionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, user_id, email, name, role, status, created_at, updated_at, login_attempts, failed_attempts, lock_until"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select("id, user_id, operator, status, started_at, ended_at, last_activity, created_at")
      .order("started_at", { ascending: false }),
  ]);

  if (profilesResult.error) {
    console.error("FETCH ADMIN USERS ERROR:", profilesResult.error);
    throw new Error("Nie udalo sie pobrac listy uzytkownikow");
  }

  if (sessionsResult.error) {
    console.warn("FETCH ADMIN USER SESSIONS ERROR:", sessionsResult.error);
  }

  const latestSessionByUser = new Map();

  for (const session of sessionsResult.data || []) {
    if (!session.user_id) continue;

    const existing = latestSessionByUser.get(session.user_id);
    const currentTimestamp = getLastActivityTimestamp(session);
    const existingTimestamp = getLastActivityTimestamp(existing);

    if (!existing || (currentTimestamp && currentTimestamp > existingTimestamp)) {
      latestSessionByUser.set(session.user_id, session);
    }
  }

  return (profilesResult.data || []).map((profile) => {
    const latestSession = latestSessionByUser.get(profile.user_id) || null;

    return {
      id: profile.user_id || profile.id,
      profileId: profile.id,
      user_id: profile.user_id,
      email: profile.email || "",
      name: profile.name || "",
      alias: profile.name || latestSession?.operator || "",
      operatorNumber: "",
      role: normalizeRole(profile.role),
      status: normalizeStatus(profile.status),
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      lock_until: profile.lock_until,
      login_attempts: profile.login_attempts ?? profile.failed_attempts ?? 0,
      last_activity: getLastActivityTimestamp(latestSession),
      latest_session_status: latestSession?.status ? String(latestSession.status).toLowerCase() : null,
    };
  });
}

export async function updateAdminUserProfile(userId, payload) {
  const nextPayload = {
    updated_at: new Date().toISOString(),
  };

  if (payload.name !== undefined) nextPayload.name = payload.name || null;
  if (payload.role !== undefined) nextPayload.role = payload.role || "user";
  if (payload.status !== undefined) nextPayload.status = payload.status || "inactive";

  const { data, error } = await supabase
    .from("profiles")
    .update(nextPayload)
    .eq("user_id", userId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("UPDATE ADMIN USER ERROR:", error);
    throw new Error("Nie udalo sie zapisac zmian uzytkownika");
  }

  return data;
}

export async function createAdminUserAccount({ email, password, role, name, status, operatorNumber }) {
  const isolatedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await isolatedClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        alias: name || null,
        operator_number: operatorNumber || null,
      },
    },
  });

  if (error) {
    console.error("CREATE ADMIN USER SIGNUP ERROR:", error);
    throw new Error(error.message || "Nie udalo sie utworzyc konta");
  }

  if (!data?.user?.id) {
    throw new Error("Nie udalo sie uzyskac identyfikatora nowego uzytkownika");
  }

  const upsertPayload = {
    user_id: data.user.id,
    email,
    name: name || null,
    role: role || "user",
    status: status || "active",
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabase.from("profiles").upsert([upsertPayload], {
    onConflict: "user_id",
  });

  if (profileError) {
    console.error("CREATE ADMIN USER PROFILE ERROR:", profileError);
    throw new Error(
      "Konto auth zostalo utworzone, ale profil nie zapisal sie poprawnie. Potrzebny jest backend lub trigger dla profiles."
    );
  }

  return {
    id: data.user.id,
    email,
    name: name || "",
    role: role || "user",
    status: status || "active",
    operatorNumber: operatorNumber || "",
  };
}

export async function resetAdminUserPassword() {
  throw new Error("Reset hasla wymaga bezpiecznego endpointu backendowego lub service role.");
}

export async function deleteAdminUserAccount() {
  throw new Error("Usuwanie kont wymaga bezpiecznego endpointu backendowego lub service role.");
}
