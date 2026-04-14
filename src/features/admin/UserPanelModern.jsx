import { Edit3, KeyRound, Plus, Search, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageShell from "../../components/layout/PageShell";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import {
  createAdminUserAccount,
  deleteAdminUserAccount,
  checkAdminUsersBackendHealth,
  fetchAdminUsersList,
  resetAdminUserPassword,
  updateAdminUserProfile,
} from "../../core/api/adminUsersApi";

const ROLE_OPTIONS = ["user", "superuser", "office", "manager", "admin"];
const STATUS_OPTIONS = ["active", "inactive"];
const INITIAL_CREATE_FORM = {
  email: "",
  password: "",
  name: "",
  operatorNumber: "",
  role: "user",
  status: "active",
};
const INITIAL_PASSWORD_FORM = {
  newPassword: "",
};

function formatLastActivity(value) {
  if (!value) {
    return "Brak aktywnosci";
  }

  return new Date(value).toLocaleString();
}

function formatLastLogin(value) {
  if (!value) {
    return "Brak logowania";
  }

  return new Date(value).toLocaleString();
}

function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "status-badge status-badge--active";
  if (normalized === "inactive") return "status-badge status-badge--inactive";
  if (normalized === "paused") return "status-badge status-badge--paused";
  return "status-badge status-badge--neutral";
}

export default function UserPanelModern() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [draft, setDraft] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [passwordForm, setPasswordForm] = useState(INITIAL_PASSWORD_FORM);
  const [edgeAvailable, setEdgeAvailable] = useState(null);
  const [rpcAvailable, setRpcAvailable] = useState(false);

  async function loadUsers() {
    try {
      setLoading(true);
      const users = await fetchAdminUsersList();
      setRows(users);
      setRpcAvailable(
        users.some((row) => String(row.backendMode || "").includes("rpc")),
      );
      setError("");
    } catch (err) {
      setRpcAvailable(false);
      setError(err.message || "Nie udalo sie pobrac listy uzytkownikow");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let cancelled = false;

    checkAdminUsersBackendHealth().then((result) => {
      if (!cancelled) {
        setEdgeAvailable(result.ok);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !needle ||
        String(row.email || "").toLowerCase().includes(needle) ||
        String(row.alias || row.name || "").toLowerCase().includes(needle) ||
        String(row.role || "").toLowerCase().includes(needle) ||
        String(row.operatorNumber || "").toLowerCase().includes(needle);
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const userSummary = useMemo(() => {
    const totalUsers = rows.length;
    const activeAccounts = rows.filter((row) => row.status === "active").length;
    const activeSessions = rows.filter((row) => row.latest_session_status === "active").length;
    const recentLogins = rows.filter((row) => row.last_sign_in_at).length;

    return {
      totalUsers,
      activeAccounts,
      activeSessions,
      recentLogins,
    };
  }, [rows]);

  const usesFallbackBackend = rows.some((row) => row.backendMode === "fallback");

  function openEditor(user) {
    setSelectedUser(user);
    setDraft({
      ...user,
      name: user.name || "",
      operatorNumber: user.operatorNumber || "",
    });
    setPasswordForm(INITIAL_PASSWORD_FORM);
  }

  function closeEditor() {
    setSelectedUser(null);
    setDraft(null);
    setPasswordForm(INITIAL_PASSWORD_FORM);
  }

  async function handleSaveUser() {
    if (!selectedUser || !draft) return;

    try {
      setSaving(true);
      await updateAdminUserProfile(selectedUser.user_id, {
        name: draft.name,
        role: draft.role,
        status: draft.status,
        operatorNumber: draft.operatorNumber,
      });
      await loadUsers();
      closeEditor();
    } catch (err) {
      alert(err.message || "Nie udalo sie zapisac zmian");
    } finally {
      setSaving(false);
    }
  }

  function handleToggleStatus() {
    if (!draft) return;
    const nextStatus = draft.status === "active" ? "inactive" : "active";
    setDraft((current) => ({ ...current, status: nextStatus }));
  }

  async function handleCreateUser() {
    if (!createForm.email || !createForm.password) {
      alert("Email i haslo sa wymagane");
      return;
    }

    try {
      setSaving(true);
      await createAdminUserAccount(createForm);
      setEdgeAvailable(true);
      setCreateForm(INITIAL_CREATE_FORM);
      setCreateOpen(false);
      await loadUsers();
    } catch (err) {
      if (String(err.message || "").toLowerCase().includes("backend `admin-users` nie odpowiada")) {
        setEdgeAvailable(false);
      }
      alert(err.message || "Nie udalo sie utworzyc uzytkownika");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (!selectedUser) return;
    if (!passwordForm.newPassword) {
      alert("Wprowadz nowe haslo");
      return;
    }

    try {
      setSaving(true);
      await resetAdminUserPassword(selectedUser.user_id, passwordForm.newPassword);
      setEdgeAvailable(true);
      setPasswordForm(INITIAL_PASSWORD_FORM);
      alert("Haslo zostalo zresetowane.");
    } catch (err) {
      if (String(err.message || "").toLowerCase().includes("backend `admin-users` nie odpowiada")) {
        setEdgeAvailable(false);
      }
      alert(err.message || "Nie udalo sie zresetowac hasla");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser() {
    if (!selectedUser) return;

    try {
      setSaving(true);
      await deleteAdminUserAccount(selectedUser.user_id);
      setEdgeAvailable(true);
      await loadUsers();
      closeEditor();
    } catch (err) {
      if (String(err.message || "").toLowerCase().includes("backend `admin-users` nie odpowiada")) {
        setEdgeAvailable(false);
      }
      alert(err.message || "Nie udalo sie usunac uzytkownika");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      title="Uzytkownicy"
      subtitle="Lista operatorow, ich ostatnia aktywnosc i panel szybkiej administracji kontami."
      icon={<Users size={26} />}
      backTo="/admin"
      backLabel="Powrot do ustawien"
      compact
      actions={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Dodaj uzytkownika
        </Button>
      }
    >
      <div className="app-card user-toolbar-card">
        <div className="user-toolbar-row">
          <div className="app-field user-toolbar-row__search">
            <label className="app-field__label">Szukaj</label>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--app-text-soft)",
                }}
              />
              <input
                style={{ paddingLeft: 40 }}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Email, pseudonim, rola lub numer operatora"
              />
            </div>
          </div>

          <div className="app-field">
            <label className="app-field__label">Status</label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Wszystkie</option>
              <option value="active">Aktywne</option>
              <option value="inactive">Nieaktywne</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? <div className="app-card">Ladowanie listy uzytkownikow...</div> : null}
      {error ? <div className="input-error-text">{error}</div> : null}
      {!loading && !error && usesFallbackBackend ? (
        <div className="app-card" style={{ marginBottom: 16 }}>
          Lista zostala zaladowana z tabel `profiles` i `sessions`, bo edge function `admin-users` nie odpowiedziala.
          Akcje takie jak tworzenie kont, reset hasla i usuwanie wymagaja wdrozonego backendu administratorskiego.
        </div>
      ) : null}
      {!loading && !error && rpcAvailable ? (
        <div className="app-card" style={{ marginBottom: 16 }}>
          Lista i edycja profilu sa obslugiwane przez SQL RPC. Backend edge jest
          {edgeAvailable === false
            ? " niedostepny, wiec create/reset/delete pozostaja zablokowane."
            : edgeAvailable === true
              ? " aktywny, wiec pelne akcje administratorskie sa dostepne."
              : " jeszcze niezweryfikowany. Akcje create/reset/delete sprawdza go przy pierwszym uzyciu."}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="system-status-grid" style={{ marginBottom: 16 }}>
          <div className="system-status-metric system-status-metric--neutral">
            <div>
              <div className="system-status-metric__label">Liczba kont</div>
              <div className="system-status-metric__value">{userSummary.totalUsers}</div>
              <div className="system-status-metric__hint">Wszystkie profile widoczne w panelu.</div>
            </div>
          </div>
          <div className="system-status-metric system-status-metric--healthy">
            <div>
              <div className="system-status-metric__label">Aktywne konta</div>
              <div className="system-status-metric__value">{userSummary.activeAccounts}</div>
              <div className="system-status-metric__hint">Konta z dostepem do logowania.</div>
            </div>
          </div>
          <div className="system-status-metric system-status-metric--neutral">
            <div>
              <div className="system-status-metric__label">Aktywne sesje</div>
              <div className="system-status-metric__value">{userSummary.activeSessions}</div>
              <div className="system-status-metric__hint">Sesje aktualnie oznaczone jako active.</div>
            </div>
          </div>
          <div className="system-status-metric system-status-metric--neutral">
            <div>
              <div className="system-status-metric__label">Konta z logowaniem</div>
              <div className="system-status-metric__value">{userSummary.recentLogins}</div>
              <div className="system-status-metric__hint">Profile, dla ktorych mamy timestamp ostatniego logowania.</div>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="app-card">
          <div className="app-module-panel__header" style={{ marginBottom: 14 }}>
            <div>
              <h2 className="process-panel__title" style={{ fontSize: 24 }}>
                Lista uzytkownikow
              </h2>
              <p className="process-panel__subtitle">
                {filteredRows.length} kont po zastosowaniu filtrow.
              </p>
            </div>
          </div>

          <div className="dashboard-table-scroll">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Uzytkownik</th>
                  <th>Rola</th>
                  <th>Status</th>
                  <th>Ostatnie logowanie</th>
                  <th>Ostatnia aktywnosc</th>
                  <th>Numer operatora</th>
                  <th>Sesja</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="user-inline">
                        <div className="user-table-avatar">
                          {(row.alias || row.email || "?").slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="user-inline__title">{row.alias || "Brak pseudonimu"}</div>
                          <div className="user-inline__meta">{row.email || "Brak emaila"}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{row.role}</td>
                    <td>
                      <span className={getStatusClass(row.status)}>
                        {row.status === "active" ? "Aktywne" : "Nieaktywne"}
                      </span>
                    </td>
                    <td>{formatLastLogin(row.last_sign_in_at)}</td>
                    <td>{formatLastActivity(row.last_activity)}</td>
                    <td>{row.operatorNumber || "-"}</td>
                    <td>
                      <span className={getStatusClass(row.latest_session_status)}>
                        {row.latest_session_status || "brak"}
                      </span>
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        size="md"
                        disabled={!rpcAvailable}
                        onClick={() => openEditor(row)}
                      >
                        <Edit3 size={16} />
                        Edytuj
                      </Button>
                    </td>
                  </tr>
                ))}

                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="app-empty-state">
                      Brak uzytkownikow spelniajacych filtry.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div className="history-modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <div className="history-modal__header">
              <div>
                <h2 className="process-panel__title" style={{ fontSize: 26, margin: 0 }}>
                  Dodaj uzytkownika
                </h2>
                <p className="process-panel__subtitle">
                  Utworz nowe konto operatora i przygotuj jego profil roboczy.
                </p>
              </div>
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                Zamknij
              </Button>
            </div>

            <div className="history-modal__grid">
              <Input
                label="Email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="operator@firma.pl"
              />
              <Input
                label="Haslo startowe"
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Wprowadz haslo"
              />
              <Input
                label="Pseudonim / imie operatora"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Np. Jan"
              />
              <Input
                label="Numer operatora"
                value={createForm.operatorNumber}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, operatorNumber: event.target.value }))
                }
                placeholder="Np. OP-014"
              />
              <div className="app-field">
                <label className="app-field__label">Rola</label>
                <select
                  value={createForm.role}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, role: event.target.value }))
                  }
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="app-field">
                <label className="app-field__label">Status</label>
                <select
                  value={createForm.status}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status === "active" ? "Aktywne" : "Nieaktywne"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="helper-note" style={{ marginTop: 14 }}>
              To konto zostanie utworzone przez bezpieczny backend administratorski, bez obchodzenia sesji zalogowanego admina.
            </p>
            {edgeAvailable === false ? (
              <p className="input-error-text" style={{ marginTop: 10 }}>
                Tworzenie kont jest chwilowo niedostepne, bo backend `admin-users` nie odpowiada.
              </p>
            ) : null}

            <div className="process-actions" style={{ marginTop: 20 }}>
              <Button loading={saving} onClick={handleCreateUser}>
                <UserPlus size={16} />
                Utworz konto
              </Button>
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                Anuluj
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedUser && draft ? (
        <div className="history-modal-overlay" onClick={closeEditor}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <div className="history-modal__header">
              <div>
                <h2 className="process-panel__title" style={{ fontSize: 26, margin: 0 }}>
                  Edycja uzytkownika
                </h2>
                <p className="process-panel__subtitle">
                  {selectedUser.email || "Brak emaila"} - ostatnia aktywnosc: {formatLastActivity(selectedUser.last_activity)}
                </p>
              </div>
              <Button variant="secondary" onClick={closeEditor}>
                Zamknij
              </Button>
            </div>

            <div className="history-modal__grid">
              <Input label="Email" value={draft.email || ""} disabled />
              <Input
                label="Pseudonim / imie operatora"
                value={draft.name || ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Wprowadz imie operatora"
              />
              <div className="app-field">
                <label className="app-field__label">Rola</label>
                <select
                  value={draft.role}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, role: event.target.value }))
                  }
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="app-field">
                <label className="app-field__label">Status konta</label>
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status === "active" ? "Aktywne" : "Nieaktywne"}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Numer operatora"
                value={draft.operatorNumber || ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, operatorNumber: event.target.value }))
                }
                placeholder="Np. OP-014"
              />
              <div className="app-card" style={{ padding: 16 }}>
                <div className="app-field__label">Ostatnie logowanie</div>
                <div style={{ marginTop: 8, fontWeight: 700 }}>
                  {formatLastLogin(selectedUser.last_sign_in_at)}
                </div>
                <div className="helper-note" style={{ marginTop: 8 }}>
                  Ta data pochodzi z warstwy logowania Supabase Auth.
                </div>
              </div>
              <div className="app-card" style={{ padding: 16 }}>
                <div className="app-field__label">Ostatnia sesja</div>
                <div style={{ marginTop: 8, fontWeight: 700 }}>
                  {selectedUser.latest_session_status || "brak"}
                </div>
                <div className="helper-note" style={{ marginTop: 8 }}>
                  Status sesji pochodzi z ostatniej sesji z tabeli sessions.
                </div>
              </div>
              <Input
                label="Nowe haslo"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm({ newPassword: event.target.value })}
                placeholder="Wprowadz nowe haslo do resetu"
              />
            </div>

            <p className="helper-note" style={{ marginTop: 14 }}>
              Zmiana roli, aktywacja, dezaktywacja, pseudonim i numer operatora sa przygotowane pod bezpieczny backend administracyjny.
            </p>
            {!rpcAvailable || edgeAvailable === false ? (
              <p className="input-error-text" style={{ marginTop: 10 }}>
                {!rpcAvailable
                  ? "Edycja profilu jest chwilowo niedostepna, bo backend RPC nie odpowiedzial."
                  : "Reset hasla i usuwanie sa chwilowo wylaczone, dopoki backend `admin-users` nie zostanie wdrozony."}
              </p>
            ) : null}

            <div className="process-actions" style={{ marginTop: 20 }}>
              <Button disabled={!rpcAvailable} loading={saving} onClick={handleSaveUser}>
                <Shield size={16} />
                Zapisz zmiany
              </Button>
              <Button disabled={!rpcAvailable} variant="secondary" onClick={handleToggleStatus}>
                {draft.status === "active" ? "Dezaktywuj konto" : "Aktywuj konto"}
              </Button>
            </div>

            <div className="process-actions" style={{ marginTop: 12 }}>
              <Button disabled={edgeAvailable === false} variant="secondary" loading={saving} onClick={handlePasswordReset}>
                <KeyRound size={16} />
                Reset hasla
              </Button>
              <Button disabled={edgeAvailable === false} variant="secondary" loading={saving} onClick={handleDeleteUser}>
                <Trash2 size={16} />
                Usun uzytkownika
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
