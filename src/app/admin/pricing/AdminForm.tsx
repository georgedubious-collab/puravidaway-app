"use client";

import { AdminActionForm, type ConfirmRule } from "@/components/admin/AdminActionForm";
import type { TeamLang } from "@/lib/teamLang";
import type { FormState } from "./actions";

/** The pricing page's forms: the shared admin form (saved / error / in-page confirmation). */
export function AdminForm({
  action,
  children,
  lang,
  submitLabel,
  className = "",
  confirm,
  danger,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  lang: TeamLang;
  submitLabel?: string;
  className?: string;
  confirm?: ConfirmRule[];
  danger?: boolean;
}) {
  return (
    <AdminActionForm action={action} lang={lang} submitLabel={submitLabel} className={className} confirm={confirm} danger={danger}>
      {children}
    </AdminActionForm>
  );
}
