import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch } from "../api/client";

interface User {
  id: number;
  name: string;
  email: string;
  access_level: "admin" | "user";
  active: boolean;
}

const emptyUserForm = {
  name: "",
  email: "",
  password: "",
  access_level: "user" as "admin" | "user",
  active: true,
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyUserForm);
  const [resetPassword, setResetPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await apiFetch<User[]>("/api/users"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => `${user.name} ${user.email} ${user.access_level}`.toLowerCase().includes(query.toLowerCase()));
  }, [users, query]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyUserForm);
    setResetPassword("");
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: "", access_level: user.access_level, active: user.active });
    setResetPassword("");
    setShowModal(true);
  };

  const saveUser = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      if (editingUser) {
        await apiFetch(`/api/admin/users/${editingUser.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            access_level: form.access_level,
            active: form.active,
          }),
        });
        if (resetPassword.trim()) {
          await apiFetch(`/api/admin/users/${editingUser.id}/reset-password`, {
            method: "POST",
            body: JSON.stringify({ new_password: resetPassword }),
          });
        }
        setMessage("User updated");
      } else {
        await apiFetch("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            access_level: form.access_level,
          }),
        });
        setMessage("User created");
      }
      setShowModal(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save user");
    }
  };

  const toggleActive = async (user: User) => {
    setError(null);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active }),
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update user status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label">Admin</p>
          <h2 className="mt-1 text-2xl font-semibold">User Management</h2>
          <p className="muted">Create accounts, update access, and handle password resets.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          New User
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div>}

      <div className="card">
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users by name, email, or role" />
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5}>
                  <div className="h-6 animate-pulse rounded bg-white/10" />
                </td>
              </tr>
            )}
            {!loading &&
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.03]">
                  <td className="font-semibold">{user.name}</td>
                  <td className="text-white/65">{user.email}</td>
                  <td className="capitalize">{user.access_level}</td>
                  <td>
                    <span className={`status-pill ${user.active ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-white/20 bg-white/10 text-white/50"}`}>
                      {user.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary" onClick={() => openEdit(user)}>
                        Edit
                      </button>
                      <button className="btn btn-secondary" onClick={() => toggleActive(user)}>
                        {user.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-white/50">
                  No users match the current search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-panel space-y-4" onSubmit={saveUser}>
            <div>
              <p className="label">{editingUser ? "Edit account" : "New account"}</p>
              <h3 className="mt-1 text-lg font-semibold">{editingUser ? editingUser.name : "Create User"}</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">Name</label>
                <input className="input mt-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input mt-2" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">Role</label>
                <select className="select mt-2" value={form.access_level} onChange={(event) => setForm({ ...form, access_level: event.target.value as "admin" | "user" })}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editingUser && (
                <div>
                  <label className="label">Status</label>
                  <select className="select mt-2" value={form.active ? "active" : "disabled"} onChange={(event) => setForm({ ...form, active: event.target.value === "active" })}>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              )}
            </div>
            {!editingUser && (
              <div>
                <label className="label">Temporary password</label>
                <input className="input mt-2" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
              </div>
            )}
            {editingUser && (
              <div>
                <label className="label">Reset password</label>
                <input className="input mt-2" type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder="Leave blank to keep current password" />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={!form.name.trim() || !form.email.trim() || (!editingUser && !form.password.trim())}>
                Save User
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
