/**
 * Adding a team member (an admin) from /admin/users (Jorge, 2026-11-13).
 *
 * Plain sign-in on the website never creates an account (bot protection, src/lib/authCode.ts) and
 * Supabase's own sign-ups are off, so a new staff member can't make one. An admin types the
 * person's email (and name) and this flow:
 *   - no account yet  → creates it with the admin API (confirmed, like the sign-in code flow) and
 *                       makes it admin;
 *   - an account      → makes it admin (same rules as changing a role in the list);
 *   - already admin   → says so, changes nothing and sends nothing;
 * then emails a short invitation (Spanish, English below): sign in at /login with this email and
 * the 6-digit code. No secret and no sign-in link in the email.
 *
 * This file has no imports, so `npm run test:admin` runs it directly in Node.
 * The database side is the existing profiles table and handle_new_user() trigger (no migration).
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normaliseInviteEmail = (v: unknown): string => (typeof v === "string" ? v.trim().toLowerCase() : "");
export const validInviteEmail = (e: string): boolean => e.length <= 254 && EMAIL.test(e) && !/[<>()[\],;:"\\]/.test(e);
/** A name typed by the admin: one line, at most 80 characters, or null. */
export const cleanInviteName = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  return s || null;
};

export type InviteRole = "client" | "driver" | "admin";

/** Why a role change from the list must be refused, or null when it's fine. */
export function roleChangeProblem(meId: string, userId: string, role: string): "pick_role" | "self_demote" | null {
  if (!userId || !["client", "driver", "admin"].includes(role)) return "pick_role";
  // Don't let an admin lock themselves out by accident (there may be no other admin).
  if (userId === meId && role !== "admin") return "self_demote";
  return null;
}

export interface InviteDeps {
  /** The account with this email, or null. */
  findUser: (email: string) => Promise<{ userId: string; role: InviteRole | null; fullName: string | null } | null>;
  /** Create a confirmed account (admin API). Resolves to the new id, or null if it failed. */
  createUser: (email: string, name: string | null) => Promise<string | null>;
  /** Make this account admin; the name is set only when given. */
  makeAdmin: (userId: string, name: string | null) => Promise<boolean>;
  sendInvite: (email: string, name: string | null) => Promise<boolean>;
}

export type InviteResult =
  | { ok: true; outcome: "created" | "promoted"; userId: string; emailed: boolean }
  | { ok: true; outcome: "already_admin"; userId: string; emailed: false }
  | { ok: false; reason: "not_admin" | "invalid_email" | "failed" };

export async function inviteTeamMember(
  input: { email: unknown; name: unknown; actorRole: string | null | undefined },
  deps: InviteDeps,
): Promise<InviteResult> {
  if (input.actorRole !== "admin") return { ok: false, reason: "not_admin" };
  const email = normaliseInviteEmail(input.email);
  if (!validInviteEmail(email)) return { ok: false, reason: "invalid_email" };
  const name = cleanInviteName(input.name);

  let found = await deps.findUser(email);
  let outcome: "created" | "promoted" = "promoted";
  if (!found) {
    const id = await deps.createUser(email, name);
    // Someone else created it at the same moment: use that account.
    found = id ? { userId: id, role: "client", fullName: name } : await deps.findUser(email);
    if (!found) return { ok: false, reason: "failed" };
    if (id) outcome = "created";
  } else if (found.role === "admin") {
    return { ok: true, outcome: "already_admin", userId: found.userId, emailed: false };
  }
  // Keep a name the person already has; fill it only when empty.
  const ok = await deps.makeAdmin(found.userId, found.fullName ? null : name);
  if (!ok) return { ok: false, reason: "failed" };
  const emailed = await deps.sendInvite(email, name ?? found.fullName);
  return { ok: true, outcome, userId: found.userId, emailed };
}

/** The invitation email: Spanish first, English below (we don't know the person's language yet). */
export function inviteEmail(siteUrl: string, email: string, name: string | null) {
  const site = siteUrl.replace(/\/$/, "");
  const first = name ? name.split(" ")[0] : "";
  return {
    subject: "Invitación al equipo de Costa Rica Private Transfers · Team invitation",
    lang: "es" as const,
    lines: [
      first ? `Hola ${first}:` : "Hola:",
      "Le invitaron al equipo de Costa Rica Private Transfers, con acceso de admin.",
      `Entre en ${site}/login con este correo (${email}) y escriba el código de 6 dígitos que le llegará. No necesita contraseña.`,
      `Consejo: en su teléfono abra ${site}/admin y elija «Agregar a inicio» para tener el ícono «CRPT Admin». Luego active las alertas en ${site}/admin/alerts.`,
      "Si no esperaba este correo, puede ignorarlo.",
      "— English —",
      first ? `Hi ${first},` : "Hi,",
      "You've been invited to the Costa Rica Private Transfers team, with admin access.",
      `Go to ${site}/login with this email (${email}) and type the 6-digit code you'll receive. No password needed.`,
      `Tip: on your phone, open ${site}/admin and choose "Add to Home Screen" to get the "CRPT Admin" icon. Then turn on alerts at ${site}/admin/alerts.`,
      "If you weren't expecting this email, you can ignore it.",
    ],
    button: { label: "Entrar · Sign in", url: `${site}/login?next=%2Fadmin` },
  };
}
