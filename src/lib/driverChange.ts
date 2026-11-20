/**
 * What happens when the team removes or replaces a booking's driver (Jorge, 2026-11-12):
 *   - the team says why ("the driver cancelled" or "team decision"); it is recorded in the history
 *     (booking_events "driver_removed") and the team is emailed;
 *   - the traveller is NOT told about the removal;
 *   - a confirmed booking left without a driver goes back to "Open for drivers" (pending_bids),
 *     which emails the approved drivers about the job as usual;
 *   - a new request or a job still open for drivers that gets a driver becomes "Confirmed"
 *     (Jorge, 2026-11-20: assigning from the admin page left it "open for drivers", so the
 *     traveller still read "request received" and the job stayed on the board);
 *   - the removed driver gets a short neutral email only when it was a team decision (when the
 *     driver cancelled, they already know);
 *   - when a driver is set (first time, replacement or after a drop-out), the ONE assignment sender
 *     (src/lib/assignmentNotices.ts, the dispatch calendar's) messages the traveller and the new
 *     driver. Nothing here sends a second "driver confirmed".
 *
 * Plain TypeScript without imports, so `npm run test:crm` runs it with Node.
 */

export type RemovalReason = "driver_dropped" | "team";

export interface DriverChange {
  /** The driver who was removed or replaced, or null. */
  removed: string | null;
  /** Reason is missing although a driver was removed. */
  needsReason: boolean;
  /**
   * The status to save: confirmed → pending_bids when the driver is removed and nobody replaces
   * them; pending_payment / pending_bids → confirmed when a driver is set.
   */
  status: string;
  reopened: boolean;
  /** Always false: the traveller is never messaged about a removal. */
  tellTravellerNow: false;
  /** Email the removed driver that the trip was reassigned (team decision only). */
  emailRemovedDriver: boolean;
}

export function driverChange(a: { beforeDriver: string | null; newDriver: string | null; status: string; reason: string }): DriverChange {
  const removed = a.beforeDriver && a.beforeDriver !== a.newDriver ? a.beforeDriver : null;
  const reopened = Boolean(removed && !a.newDriver && a.status === "confirmed");
  const needsReason = Boolean(removed) && a.reason !== "driver_dropped" && a.reason !== "team";
  return {
    removed,
    needsReason,
    status: reopened ? "pending_bids" : a.newDriver && (a.status === "pending_payment" || a.status === "pending_bids") ? "confirmed" : a.status,
    reopened,
    tellTravellerNow: false,
    emailRemovedDriver: Boolean(removed) && !needsReason && a.reason === "team",
  };
}
