import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

interface User {
  id: number;
  name: string;
  email: string;
  access_level: string;
  active: boolean;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    apiFetch<User[]>("/api/users").then(setUsers).catch(() => setUsers([]));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">User Management</h2>
          <p className="text-sm text-white/60">Create, manage, and reset access securely.</p>
        </div>
        <button className="btn btn-primary">New User</button>
      </div>
      <div className="card">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-white/50">
            <tr>
              <th className="pb-3">Name</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-white/10">
                <td className="py-3">{user.name}</td>
                <td className="py-3 text-white/60">{user.email}</td>
                <td className="py-3">{user.access_level}</td>
                <td className="py-3">{user.active ? "Active" : "Disabled"}</td>
                <td className="py-3">
                  <button className="btn btn-secondary">Reset password</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
