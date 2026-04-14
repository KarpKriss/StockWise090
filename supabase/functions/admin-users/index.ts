import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type JsonRecord = Record<string, unknown>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(status: number, payload: JsonRecord) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeRole(role: unknown) {
  return String(role || "user").toLowerCase();
}

function normalizeStatus(status: unknown) {
  return String(status || "inactive").toLowerCase();
}

function getLastActivityTimestamp(session: JsonRecord | null) {
  if (!session) return null;
  return (
    session.last_activity ||
    session.ended_at ||
    session.started_at ||
    session.created_at ||
    null
  );
}

async function getAdminContext(req: Request) {
  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    throw new Error("Brak naglowka autoryzacji");
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    throw new Error("Sesja jest niewazna lub wygasla");
  }

  const { data: adminProfile, error: profileError } = await serviceClient
    .from("profiles")
    .select("user_id, role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !adminProfile) {
    throw new Error("Nie udalo sie zweryfikowac uprawnien administratora");
  }

  if (String(adminProfile.role || "").toLowerCase() !== "admin") {
    throw new Error("Brak uprawnien administratora");
  }

  return { serviceClient, user };
}

async function listUsers(serviceClient: ReturnType<typeof createClient>) {
  const [profilesResult, sessionsResult, authUsersResult] = await Promise.all([
    serviceClient
      .from("profiles")
      .select(
        "id, user_id, email, name, role, status, created_at, updated_at, login_attempts, failed_attempts, lock_until, operator_number"
      )
      .order("created_at", { ascending: false }),
    serviceClient
      .from("sessions")
      .select("id, user_id, operator, status, started_at, ended_at, last_activity, created_at")
      .order("started_at", { ascending: false }),
    serviceClient.auth.admin.listUsers(),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (authUsersResult.error) throw authUsersResult.error;

  const authUsers = authUsersResult.data.users || [];
  const authById = new Map(authUsers.map((entry) => [entry.id, entry]));
  const latestSessionByUser = new Map<string, JsonRecord>();

  for (const session of sessionsResult.data || []) {
    if (!session.user_id) continue;

    const existing = latestSessionByUser.get(session.user_id);
    const currentTimestamp = getLastActivityTimestamp(session as JsonRecord);
    const existingTimestamp = getLastActivityTimestamp(existing || null);

    if (!existing || (currentTimestamp && currentTimestamp > existingTimestamp)) {
      latestSessionByUser.set(session.user_id, session as unknown as JsonRecord);
    }
  }

  const profileByUserId = new Map(
    (profilesResult.data || [])
      .filter((profile) => profile.user_id)
      .map((profile) => [profile.user_id, profile])
  );

  const users = authUsers.map((authUser) => {
    const profile = profileByUserId.get(authUser.id);
    const latestSession = latestSessionByUser.get(profile?.user_id || authUser.id) || null;

    return {
      id: profile?.user_id || profile?.id || authUser.id,
      profileId: profile?.id || null,
      user_id: profile?.user_id || authUser.id,
      email: profile?.email || authUser.email || "",
      name: profile?.name || "",
      alias: profile?.name || (latestSession?.operator as string) || "",
      operatorNumber: profile?.operator_number || "",
      role: normalizeRole(profile?.role),
      status: normalizeStatus(profile?.status || "active"),
      created_at: profile?.created_at || authUser.created_at || null,
      updated_at: profile?.updated_at || authUser.updated_at || null,
      lock_until: profile?.lock_until,
      login_attempts: profile?.login_attempts ?? profile?.failed_attempts ?? 0,
      last_activity:
        getLastActivityTimestamp(latestSession) ||
        authUser.last_sign_in_at ||
        null,
      latest_session_status: latestSession?.status
        ? String(latestSession.status).toLowerCase()
        : null,
      last_sign_in_at: authUser.last_sign_in_at || null,
    };
  });

  return json(200, { users });
}

async function createUser(serviceClient: ReturnType<typeof createClient>, body: JsonRecord) {
  const payload = (body.payload || {}) as JsonRecord;
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const name = String(payload.name || "").trim();
  const role = normalizeRole(payload.role);
  const status = normalizeStatus(payload.status || "active");
  const operatorNumber = String(payload.operatorNumber || "").trim();

  if (!email || !password) {
    return json(400, { error: "Email i haslo sa wymagane" });
  }

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      alias: name || null,
      operator_number: operatorNumber || null,
    },
  });

  if (createError || !created.user) {
    throw createError || new Error("Nie udalo sie utworzyc konta auth");
  }

  const { error: profileError } = await serviceClient.from("profiles").upsert(
    [
      {
        user_id: created.user.id,
        email,
        name: name || null,
        role,
        status,
        operator_number: operatorNumber || null,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "user_id" }
  );

  if (profileError) {
    throw profileError;
  }

  return json(200, {
    user: {
      id: created.user.id,
      user_id: created.user.id,
      email,
      name,
      alias: name,
      role,
      status,
      operatorNumber,
      created_at: created.user.created_at,
      last_activity: null,
      latest_session_status: null,
    },
  });
}

async function updateUser(serviceClient: ReturnType<typeof createClient>, body: JsonRecord) {
  const userId = String(body.userId || "");
  const payload = (body.payload || {}) as JsonRecord;

  if (!userId) {
    return json(400, { error: "Brak identyfikatora uzytkownika" });
  }

  const nextPayload: JsonRecord = {
    updated_at: new Date().toISOString(),
  };

  if (payload.name !== undefined) nextPayload.name = String(payload.name || "").trim() || null;
  if (payload.role !== undefined) nextPayload.role = normalizeRole(payload.role);
  if (payload.status !== undefined) nextPayload.status = normalizeStatus(payload.status);
  if (payload.operatorNumber !== undefined) {
    nextPayload.operator_number = String(payload.operatorNumber || "").trim() || null;
  }

  const { data: updatedProfile, error: profileError } = await serviceClient
    .from("profiles")
    .upsert(
      [
        {
          user_id: userId,
          ...nextPayload,
        },
      ],
      { onConflict: "user_id" }
    )
    .select()
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  await serviceClient.auth.admin.updateUserById(userId, {
    user_metadata: {
      alias: updatedProfile?.name || null,
      operator_number: updatedProfile?.operator_number || null,
    },
  });

  return json(200, { user: updatedProfile });
}

async function resetPassword(
  serviceClient: ReturnType<typeof createClient>,
  body: JsonRecord,
  adminUserId: string
) {
  const userId = String(body.userId || "");
  const newPassword = String(body.newPassword || "");

  if (!userId || !newPassword) {
    return json(400, { error: "Id uzytkownika i nowe haslo sa wymagane" });
  }

  if (userId === adminUserId) {
    return json(400, { error: "Nie resetuj wlasnego hasla tym narzedziem. Uzyj standardowej zmiany hasla." });
  }

  const { error } = await serviceClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) throw error;

  return json(200, { success: true });
}

async function deleteUser(
  serviceClient: ReturnType<typeof createClient>,
  body: JsonRecord,
  adminUserId: string
) {
  const userId = String(body.userId || "");

  if (!userId) {
    return json(400, { error: "Brak identyfikatora uzytkownika" });
  }

  if (userId === adminUserId) {
    return json(400, { error: "Nie mozna usunac aktualnie zalogowanego administratora." });
  }

  const { error: sessionsError } = await serviceClient
    .from("sessions")
    .delete()
    .eq("user_id", userId);
  if (sessionsError) throw sessionsError;

  const { error: profileError } = await serviceClient
    .from("profiles")
    .delete()
    .eq("user_id", userId);
  if (profileError) throw profileError;

  const { error: authError } = await serviceClient.auth.admin.deleteUser(userId);
  if (authError) throw authError;

  return json(200, { success: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = (await req.json()) as JsonRecord;
    const action = String(body.action || "");
    const { serviceClient, user } = await getAdminContext(req);

    switch (action) {
      case "health":
        return json(200, {
          ok: true,
          serviceRoleConfigured: Boolean(SUPABASE_SERVICE_ROLE_KEY),
          capabilities: {
            list: true,
            create: true,
            update: true,
            resetPassword: true,
            delete: true,
          },
        });
      case "list":
        return await listUsers(serviceClient);
      case "create":
        return await createUser(serviceClient, body);
      case "update":
        return await updateUser(serviceClient, body);
      case "reset-password":
        return await resetPassword(serviceClient, body, user.id);
      case "delete":
        return await deleteUser(serviceClient, body, user.id);
      default:
        return json(400, { error: "Nieznana akcja administracyjna" });
    }
  } catch (error) {
    console.error("ADMIN USERS FUNCTION ERROR:", error);
    return json(500, {
      error: error instanceof Error ? error.message : "Nieznany blad funkcji administracyjnej",
    });
  }
});
