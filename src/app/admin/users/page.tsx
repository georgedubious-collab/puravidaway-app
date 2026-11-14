import { AdminActionForm, type ConfirmRule } from "@/components/admin/AdminActionForm";
import { Card, Chip, EmptyState, field, PageHeader } from "@/components/admin/ui";
import { requireRole, type Profile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { inviteAdmin, setUserRole } from "./actions";

/** Email · name · joined · role on wide screens; on phones each person is a small card. */
const COLS = "md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_6.5rem_minmax(15rem,auto)]";

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

  /** The "are you sure?" box: removing admin says what they lose; making admin says what they get. */
  const confirmFor = (u: Profile): ConfirmRule[] => {
    const who = u.email ?? t("Esta persona", "This person");
    if (u.role === "admin")
      return [
        {
          kind: "changed",
          fields: ["role"],
          message: t(
            `${who} deja de ser admin y pasa a «{to}». Ya no podrá entrar a la administración.`,
            `${who} stops being an admin and becomes "{to}". They won't be able to open the admin any more.`,
          ),
        },
      ];
    return [
      { kind: "changed", fields: ["role"], message: t(`${who} pasa de «{from}» a «{to}».`, `${who} goes from "{from}" to "{to}".`) },
      {
        kind: "equals",
        field: "role",
        values: ["admin"],
        message: t(
          "Un admin ve y cambia todo, incluidos los datos de viajeros y conductores.",
          "An admin sees and changes everything, travellers' and drivers' details included.",
        ),
      },
    ];
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Usuarios y roles", "Users & roles")}
        subtitle={
          lang === "en" ? (
            <>
              Everyone who signs in starts as a client. Drivers apply at <code>/driver</code> and get the <strong>driver</strong> role when you
              approve them in <strong>Drivers</strong>. Add staff with the card below, or make an existing account <strong>admin</strong> in the
              list.
            </>
          ) : (
            <>
              Toda persona que inicia sesión empieza como cliente. Los conductores se postulan en <code>/driver</code> y reciben el rol de{" "}
              <strong>conductor</strong> cuando usted los aprueba en <strong>Conductores</strong>. Agregue personal con la tarjeta de abajo, o
              haga <strong>admin</strong> una cuenta que ya existe en la lista.
            </>
          )
        }
      />

      <Card title={t("Agregar una persona del equipo", "Add a team member")} id="invite-title">
        <p className="mb-3 text-sm leading-relaxed text-[#5F6F67]">
          {t(
            "Crea la cuenta si no existe, la hace admin y le envía un correo para entrar con su correo y el código de 6 dígitos. Un admin ve y cambia todo.",
            "Creates the account if needed, makes it admin and emails them how to sign in with their email and the 6-digit code. An admin sees and changes everything.",
          )}
        </p>
        <AdminActionForm action={inviteAdmin} lang={lang} submitLabel={t("Invitar como admin", "Invite as admin")}
          className="grid gap-3 sm:grid-cols-2"
          confirm={[
            {
              kind: "always",
              message: t(
                "Esta persona será admin: verá y cambiará todo, incluidos los datos de viajeros y conductores.",
                "This person will be an admin: they'll see and change everything, travellers' and drivers' details included.",
              ),
            },
          ]}
          confirmLabel={t("Sí, invitar", "Yes, invite")}
        >
          <label className={field.label}>
            {t("Correo", "Email")}
            <input name="email" type="email" required autoComplete="off" inputMode="email" maxLength={254} className={field.input} />
          </label>
          <label className={field.label}>
            {t("Nombre (opcional)", "Name (optional)")}
            <input name="name" type="text" autoComplete="off" maxLength={80} className={field.input} />
          </label>
        </AdminActionForm>
      </Card>

      <Card padded={false} title={t("Personas", "People")} id="people-title">
        {users.length === 0 ? (
          <EmptyState title={t("Todavía no hay usuarios.", "No users yet.")} />
        ) : (
          <div role="table" aria-label={t("Usuarios y roles", "Users & roles")}>
            <div
              role="row"
              className={`hidden gap-4 border-b border-[#EDF1EE] px-5 py-2.5 text-xs font-extrabold uppercase tracking-[0.05em] text-[#5F6F67] md:grid ${COLS}`}
            >
              <span role="columnheader">{t("Correo", "Email")}</span>
              <span role="columnheader">{t("Nombre", "Name")}</span>
              <span role="columnheader">{t("Registro", "Joined")}</span>
              <span role="columnheader">{t("Rol", "Role")}</span>
            </div>
            <div role="rowgroup" className="divide-y divide-[#EDF1EE]">
              {users.map((u) => (
                <div key={u.id} role="row" className={`grid gap-1 px-4 py-3.5 md:items-center md:gap-4 md:px-5 ${COLS}`}>
                  <span role="cell" className="break-all text-sm font-bold text-[#14231C] md:font-normal">
                    {u.email ?? "—"}
                  </span>
                  <span role="cell" className="text-sm text-[#33443C]">
                    {u.full_name ?? <span className="text-[#5F6F67]">—</span>}
                  </span>
                  <span role="cell" className="text-xs text-[#5F6F67] md:text-sm">
                    <span className="md:hidden">{t("Registro: ", "Joined: ")}</span>
                    {u.created_at.slice(0, 10)}
                  </span>
                  <div role="cell" className="pt-1.5 md:pt-0">
                    {u.id === me.id ? (
                      <Chip tone="green">admin · {t("usted", "you")}</Chip>
                    ) : (
                      <AdminActionForm
                        // A new key when the saved role changes, so the picker shows the saved
                        // role after "Guardar" instead of the role it was first drawn with.
                        key={`${u.id}:${u.role}`}
                        action={setUserRole}
                        lang={lang}
                        className="flex flex-wrap items-center gap-2"
                        confirm={confirmFor(u)}
                        confirmLabel={u.role === "admin" ? t("Sí, quitar admin", "Yes, remove admin") : undefined}
                      >
                        <input type="hidden" name="userId" value={u.id} />
                        <label className="sr-only" htmlFor={`role-${u.id}`}>
                          {t("Rol de", "Role for")} {u.email}
                        </label>
                        <select
                          id={`role-${u.id}`}
                          name="role"
                          defaultValue={u.role}
                          className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#DCE3DF] bg-white px-2 text-sm md:flex-none"
                        >
                          {(["client", "driver", "admin"] as const).map((r) => (
                            <option key={r} value={r}>
                              {roleName(r)}
                            </option>
                          ))}
                        </select>
                      </AdminActionForm>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
