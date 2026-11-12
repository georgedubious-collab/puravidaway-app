import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { Card, Chip, DataTable, EmptyState, PageHeader, Td, Th } from "@/components/admin/ui";
import { requireRole, type Profile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { setUserRole } from "./actions";

export default async function UsersPage() {
  const me = await requireRole("admin", "/admin/users");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const supabase = (await createSupabaseServerClient())!;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, phone, created_at")
    .order("created_at", { ascending: false })
    .returns<(Profile & { created_at: string })[]>();
  const users = data ?? [];
  const roleName = (r: string) => (r === "client" ? t("cliente", "client") : r === "driver" ? t("conductor", "driver") : "admin");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Usuarios y roles", "Users & roles")}
        subtitle={
          lang === "en" ? (
            <>
              Everyone who signs in starts as a client. Drivers apply at <code>/driver</code> and get the <strong>driver</strong> role when you
              approve them in <strong>Drivers</strong>. Make trusted staff <strong>admin</strong> here.
            </>
          ) : (
            <>
              Toda persona que inicia sesión empieza como cliente. Los conductores se postulan en <code>/driver</code> y reciben el rol de{" "}
              <strong>conductor</strong> cuando usted los aprueba en <strong>Conductores</strong>. Aquí puede hacer <strong>admin</strong> al
              personal de confianza.
            </>
          )
        }
      />
      <Card padded={false}>
        {users.length === 0 ? (
          <EmptyState title={t("Todavía no hay usuarios.", "No users yet.")} />
        ) : (
          <DataTable minWidth={760} caption={t("Usuarios y roles", "Users & roles")}>
            <thead>
              <tr>
                <Th>{t("Correo", "Email")}</Th>
                <Th>{t("Nombre", "Name")}</Th>
                <Th>{t("Registro", "Joined")}</Th>
                <Th>{t("Rol", "Role")}</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <Td className="break-all">{u.email}</Td>
                  <Td>{u.full_name ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{u.created_at.slice(0, 10)}</Td>
                  <Td>
                    {u.id === me.id ? (
                      <Chip tone="green">admin · {t("usted", "you")}</Chip>
                    ) : (
                      <AdminActionForm
                        action={setUserRole}
                        lang={lang}
                        className="flex flex-wrap items-center gap-2"
                        confirm={[
                          {
                            kind: "changed",
                            fields: ["role"],
                            message: t(
                              `${u.email ?? "Esta persona"} pasa de «{from}» a «{to}». Un admin ve y cambia todo, incluidos los datos de viajeros y conductores.`,
                              `${u.email ?? "This person"} goes from "{from}" to "{to}". An admin sees and changes everything, travellers' and drivers' details included.`,
                            ),
                          },
                        ]}
                      >
                        <input type="hidden" name="userId" value={u.id} />
                        <label className="sr-only" htmlFor={`role-${u.id}`}>
                          {t("Rol de", "Role for")} {u.email}
                        </label>
                        <select
                          id={`role-${u.id}`}
                          name="role"
                          defaultValue={u.role}
                          className="min-h-10 rounded-xl border border-[#DCE3DF] bg-white px-2 text-sm"
                        >
                          {(["client", "driver", "admin"] as const).map((r) => (
                            <option key={r} value={r}>
                              {roleName(r)}
                            </option>
                          ))}
                        </select>
                      </AdminActionForm>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
