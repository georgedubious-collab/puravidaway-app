/** Result of a form Server Action, shown inline next to the submit button. */
export interface FormState {
  ok?: boolean;
  error?: string;
  /** Changes on every successful save so the form can show "Saved". */
  savedAt?: number;
  /** Shown instead of "Saved" when the action has something to say ("Invitation sent"). */
  message?: string;
}

/** A user-facing validation problem (its message is shown as-is). */
export class InputError extends Error {}

function isRedirect(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "digest" in e &&
    String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

/** Run an action body, turning errors into a FormState instead of a crash page. */
export async function runAction(fn: () => Promise<void | string>, fallback: string): Promise<FormState> {
  try {
    const message = await fn();
    return { ok: true, savedAt: Date.now(), ...(message ? { message } : {}) };
  } catch (e) {
    if (isRedirect(e)) throw e;
    if (e instanceof InputError) return { error: e.message };
    console.error("[form action]", e);
    return { error: fallback };
  }
}
