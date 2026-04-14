import { supabase } from "./supabaseClient";

function normalizeAdminUser(entry = {}) {
  return {
    ...entry,
    operatorNumber: entry.operatorNumber ?? entry.operator_number ?? "",
    last_sign_in_at:
      entry.last_sign_in_at ?? entry.lastSignInAt ?? entry.last_login_at ?? null,
    latest_session_status:
      entry.latest_session_status ?? entry.latestSessionStatus ?? null,
    last_activity: entry.last_activity ?? entry.lastActivity ?? null,
  };
}

function unwrapFunctionError(error) {
  if (!error) {
    return new Error("Nieznany blad backendu administracyjnego");
  }

  const message =
    error.context?.json?.error ||
    error.context?.json?.message ||
    error.message ||
    "Nieznany blad backendu administracyjnego";

  return new Error(message);
}

function isEdgeFunctionUnavailable(error) {
  const message = String(
    error?.context?.json?.error ||
      error?.context?.json?.message ||
      error?.message ||
      ""
  ).toLowerCase();

  return (
    message.includes("failed to send a request to the edge function") ||
    message.includes("edge function returned a non-2xx status code") ||
    message.includes("functions fetch failed") ||
    message.includes("function not found")
  );
}

async function invokeAdminUsers(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: {
      action,
      ...payload,
    },
  });

  if (error) {
    console.error(`ADMIN USERS FUNCTION ERROR [${action}]:`, error);
    throw unwrapFunctionError(error);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function checkAdminUsersBackendHealth() {
  try {
    const data = await invokeAdminUsers("health");
    return {
      ok: Boolean(data?.ok),
      capabilities: data?.capabilities || {},
      serviceRoleConfigured: Boolean(data?.serviceRoleConfigured ?? true),
    };
  } catch (error) {
    return {
      ok: false,
      capabilities: {},
      serviceRoleConfigured: false,
    };
  }
}

async function fetchAdminUsersListFromEdge() {
  const data = await invokeAdminUsers("list");
  return (data?.users || []).map((entry) =>
    normalizeAdminUser({ ...entry, backendMode: "edge" }),
  );
}


async function invokeAdminRpc(functionName, payload = {}) {
  const { data, error } = await supabase.rpc(functionName, payload);

  if (error) {
    console.error(`ADMIN RPC ERROR [${functionName}]:`, error);
    throw new Error(error.message || `Blad funkcji ${functionName}`);
  }

  return data;
}

async function fetchAdminUsersListFallback() {
  const [profilesResult, sessionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, user_id, email, name, role, status, created_at, updated_at, login_attempts, failed_attempts, lock_until, operator_number"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select("id, user_id, operator, status, started_at, ended_at, last_activity, created_at")
      .order("started_at", { ascending: false }),
  ]);

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message || "Nie udalo sie pobrac profili uzytkownikow");
  }

  if (sessionsResult.error) {
    throw new Error(sessionsResult.error.message || "Nie udalo sie pobrac aktywnosci sesji");
  }

  const latestSessionByUser = new Map();

  for (const session of sessionsResult.data || []) {
    if (!session.user_id || latestSessionByUser.has(session.user_id)) continue;
    latestSessionByUser.set(session.user_id, session);
  }

  return (profilesResult.data || []).map((profile) => {
    const latestSession = latestSessionByUser.get(profile.user_id || "") || null;

    return {
      id: profile.user_id || profile.id,
      profileId: profile.id,
      user_id: profile.user_id,
      email: profile.email || "",
      name: profile.name || "",
      alias: profile.name || latestSession?.operator || "",
      operatorNumber: profile.operator_number || "",
      role: String(profile.role || "user").toLowerCase(),
      status: String(profile.status || "inactive").toLowerCase(),
      created_at: profile.created_at || null,
      updated_at: profile.updated_at || null,
      lock_until: profile.lock_until,
      login_attempts: profile.login_attempts ?? profile.failed_attempts ?? 0,
      last_activity:
        latestSession?.last_activity ||
        latestSession?.ended_at ||
        latestSession?.started_at ||
        latestSession?.created_at ||
        null,
      latest_session_status: latestSession?.status ? String(latestSession.status).toLowerCase() : null,
      backendMode: "fallback",
    };
  });
}

function requireEdgeFunctionFeature(message) {
  throw new Error(
    `${message} Backend admin-users nie odpowiada. Wdroz edge function, aby uzyc tej akcji.`
  );
}

export async function fetchAdminUsersList() {
  let baseUsers = [];

  try {
    const data = await invokeAdminRpc("get_admin_users_overview");
    baseUsers = (data || []).map((entry) =>
      normalizeAdminUser({ ...entry, backendMode: "rpc" })
    );
  } catch (error) {
    baseUsers = await fetchAdminUsersListFallback();
  }

  try {
    const edgeUsers = await fetchAdminUsersListFromEdge();
    const edgeByUserId = new Map(
      edgeUsers
        .filter((entry) => entry.user_id)
        .map((entry) => [entry.user_id, entry]),
    );

    return baseUsers.map((entry) => {
      const edgeEntry = edgeByUserId.get(entry.user_id);

      if (!edgeEntry) {
        return entry;
      }

      return normalizeAdminUser({
        ...entry,
        email: edgeEntry.email || entry.email,
        name: edgeEntry.name || entry.name,
        alias: edgeEntry.alias || entry.alias,
        last_sign_in_at: edgeEntry.last_sign_in_at || entry.last_sign_in_at,
        last_activity: edgeEntry.last_activity || entry.last_activity,
        latest_session_status:
          edgeEntry.latest_session_status || entry.latest_session_status,
        backendMode:
          entry.backendMode === "rpc" ? "rpc+edge" : edgeEntry.backendMode || entry.backendMode,
      });
    });
  } catch (error) {
    return baseUsers;
  }
}

export async function updateAdminUserProfile(userId, payload) {
  try {
    const rows = await invokeAdminRpc("admin_update_user_profile", {
      p_user_id: userId,
      p_name: payload.name ?? null,
      p_role: payload.role ?? null,
      p_status: payload.status ?? null,
      p_operator_number: payload.operatorNumber ?? null,
    });

    return normalizeAdminUser(Array.isArray(rows) ? rows[0] : rows);
  } catch (error) {
    throw error;
  }
}

export async function createAdminUserAccount(payload) {
  try {
    const data = await invokeAdminUsers("create", {
      payload,
    });

    return data.user;
  } catch (error) {
    if (isEdgeFunctionUnavailable(error)) {
      requireEdgeFunctionFeature("Nie udalo sie utworzyc konta.");
    }
    throw error;
  }
}

export async function resetAdminUserPassword(userId, newPassword) {
  try {
    const data = await invokeAdminUsers("reset-password", {
      userId,
      newPassword,
    });

    return data;
  } catch (error) {
    if (isEdgeFunctionUnavailable(error)) {
      requireEdgeFunctionFeature("Nie udalo sie zresetowac hasla.");
    }
    throw error;
  }
}

export async function deleteAdminUserAccount(userId) {
  try {
    const data = await invokeAdminUsers("delete", {
      userId,
    });

    return data;
  } catch (error) {
    if (isEdgeFunctionUnavailable(error)) {
      requireEdgeFunctionFeature("Nie udalo sie usunac uzytkownika.");
    }
    throw error;
  }
}
