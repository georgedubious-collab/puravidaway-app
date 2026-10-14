import { requireRole, type Profile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setUserRole } from "./actions";

export default async function UsersPage() {
  const me = await requireRole("admin", "/admin/users");
  const supabase = (await createSupabaseServerClient())!;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, phone, created_at")
    .order("created_at", { ascending: false })
    .returns<(Profile & { created_at: string })[]>();
  const users = data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-900">Users &amp; roles</h1>
      <p className="text-sm text-slate-600">
        Everyone who signs in starts as a client. Drivers apply at <code>/driver</code> and get the{" "}
        <strong>driver</strong> role when you approve them in <strong>Drivers</strong>. Make trusted
        staff <strong>admin</strong> here.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-bold">Email</th>
              <th className="px-4 py-3 font-bold">Name</th>
              <th className="px-4 py-3 font-bold">Joined</th>
              <th className="px-4 py-3 font-bold">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.full_name ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">{u.created_at.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <form action={setUserRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <label className="sr-only" htmlFor={`role-${u.id}`}>
                      Role for {u.email}
                    </label>
                    <select
                      id={`role-${u.id}`}
                      name="role"
                      defaultValue={u.role}
                      disabled={u.id === me.id}
                      className="min-h-10 rounded-lg border border-slate-300 px-2"
                    >
                      <option value="client">client</option>
                      <option value="driver">driver</option>
                      <option value="admin">admin</option>
                    </select>
                    {u.id !== me.id && (
                      <button
                        type="submit"
                        className="min-h-10 px-3 rounded-lg bg-emerald-950 text-white font-bold"
                      >
                        Save
                      </button>
                    )}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
