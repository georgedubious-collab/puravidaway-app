"use server";

import { revalidatePath } from "next/cache";
import { requireRole, type Role } from "@/lib/auth";
import { sendEmail, SITE_URL } from "@/lib/email";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { inviteEmail, inviteTeamMember, roleChangeProblem, type InviteRole } from "@/lib/teamInvite";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

/** Change someone's role. Returns a readable error instead of a blank error page. */
export async function setUserRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    const me = await requireRole("admin", "/admin/users");
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "") as Role;
    const problem = roleChangeProblem(me.id, userId, role);
    if (problem === "pick_role") throw new InputError(t("Elija un rol.", "Pick a role."));
    // Don't let the last admin lock themselves out by accident.
    if (problem === "self_demote") throw new InputError(t("No puede quitarse su propio rol de admin.", "You can't remove your own admin role."));

    const supabase = (await createSupabaseServerClient())!;
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
    if (error) throw new Error(error.message);

    if (role === "driver") {
      // New drivers get an empty KYC record in "pending" until their documents are checked.
      const d = await supabase.from("drivers").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
      if (d.error) throw new Error(d.error.message);
    }
    revalidatePath("/admin/users");
  }, t("No se pudo cambiar el rol. Inténtelo de nuevo.", "Couldn't change the role. Please try again."));
}

/**
 * "Agregar una persona del equipo": create the account if needed, make it admin and email an
 * invitation (rules: src/lib/teamInvite.ts). No audit table for roles exists, so it is logged on
 * the server with ids only.
 */
export async function inviteAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = makeT(await getTeamLang());
  return runAction(async () => {
    const me = await requireRole("admin", "/admin/users");
    const admin = createSupabaseAdminClient();
    if (!admin) throw new InputError(t("Falta la llave del servidor de Supabase (SUPABASE_SERVICE_ROLE_KEY).", "The Supabase server key is missing (SUPABASE_SERVICE_ROLE_KEY)."));

    const out = await inviteTeamMember(
      { email: formData.get("email"), name: formData.get("name"), actorRole: me.role },
      {
        findUser: async (email) => {
          const { data, error } = await admin.rpc("auth_email_status", { p_email: email });
          if (error) throw new Error(error.message);
          const row = (Array.isArray(data) ? data[0] : data) as { user_id: string | null } | undefined;
          if (!row?.user_id) return null;
          const p = await admin.from("profiles").select("role, full_name").eq("id", row.user_id).maybeSingle();
          if (p.error) throw new Error(p.error.message);
          return { userId: row.user_id, role: (p.data?.role ?? null) as InviteRole | null, fullName: p.data?.full_name ?? null };
        },
        createUser: async (email, name) => {
          // Confirmed, like the sign-in code flow (src/lib/authCodeServer.ts): with public sign-ups
          // off Supabase only emails codes to confirmed accounts; the code still proves the inbox.
          const { data, error } = await admin.auth.admin.createUser({
            email,
            email_confirm: true,
            ...(name ? { user_metadata: { full_name: name } } : {}),
          });
          if (error) {
            if (!/already|registered|exists/i.test(error.message)) console.error("[team-invite] create user failed", error.message);
            return null;
          }
          return data.user?.id ?? null;
        },
        makeAdmin: async (userId, name) => {
          // handle_new_user() made the profile; the service role skips the role guard.
          const { data, error } = await admin
            .from("profiles")
            .update({ role: "admin", ...(name ? { full_name: name } : {}) })
            .eq("id", userId)
            .select("id");
          if (error) console.error("[team-invite] make admin failed", error.message);
          return !error && (data?.length ?? 0) === 1;
        },
        sendInvite: async (email, name) => sendEmail({ to: email, ...inviteEmail(SITE_URL, email, name) }),
      },
    );

    if (!out.ok) {
      if (out.reason === "invalid_email") throw new InputError(t("Escriba un correo válido.", "Type a valid email."));
      if (out.reason === "not_admin") throw new InputError(t("Solo un admin puede invitar.", "Only an admin can invite."));
      throw new Error("invite failed");
    }
    if (out.outcome === "already_admin") return t("Esta persona ya es admin. No se cambió nada.", "This person is already an admin. Nothing changed.");

    console.info(`[team-invite] admin ${me.id} made ${out.userId} admin (${out.outcome}), email ${out.emailed ? "sent" : "not sent"}`);
    revalidatePath("/admin/users");
    const done =
      out.outcome === "created"
        ? t("Cuenta creada y hecha admin.", "Account created and made admin.")
        : t("Su cuenta ya existía; ahora es admin.", "They already had an account; now admin.");
    return out.emailed
      ? `${done} ${t("Invitación enviada.", "Invitation sent.")}`
      : `${done} ${t("No se pudo enviar el correo: dígale que entre en /login con su correo.", "The email couldn't be sent: tell them to sign in at /login with their email.")}`;
  }, t("No se pudo invitar. Inténtelo de nuevo.", "Couldn't send the invitation. Please try again."));
}
