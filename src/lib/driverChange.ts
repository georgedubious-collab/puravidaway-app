/**
 * What happens when the team changes a booking's driver on the booking page (Jorge, 2026-11-12):
 *   - removing or replacing the assigned driver needs a reason ("the driver cancelled" or
 *     "team decision"), is recorded in the history (booking_events "driver_removed") and the team
 *     is emailed;
 *   - the traveller is NOT told at that moment;
 *   - a confirmed booking left without a driver goes back to "Open for drivers" (pending_bids),
 *     which emails the approved drivers about the job as usual;
 *   - when a new driver is assigned on a confirmed booking after a removal, the traveller gets the
 *     existing "driver confirmed" email (as when an offer is accepted).
 *
 * Plain TypeScript without imports, so `npm run test:crm` runs it with Node.
 */

export type RemovalReason = "driver_dropped" | "team";

export interface DriverChange {
  /** The driver who was removed or replaced, or null. */
  removed: string | null;
  /** Reason is missing although a driver was removed. */
  needsReason: boolean;
  /** The status to save (confirmed → pending_bids when the driver is removed and nobody replaces them). */
  status: string;
  reopened: boolean;
  /** Always false: the traveller is never messaged about a removal. */
  tellTravellerNow: false;
  /** Send the existing "driver confirmed" email to the traveller (new driver after a removal). */
  sendDriverConfirmed: boolean;
}

export function driverChange(a: {
  beforeDriver: string | null;
  newDriver: string | null;
  status: string;
  reason: string;
  /** A driver was removed from this booking earlier (booking_events "driver_removed"). */
  hadRemovalBefore: boolean;
}): DriverChange {
  const removed = a.beforeDriver && a.beforeDriver !== a.newDriver ? a.beforeDriver : null;
  const reopened = Boolean(removed && !a.newDriver && a.status === "confirmed");
  const status = reopened ? "pending_bids" : a.status;
  const newOne = Boolean(a.newDriver && a.newDriver !== a.beforeDriver);
  return {
    removed,
    needsReason: Boolean(removed) && a.reason !== "driver_dropped" && a.reason !== "team",
    status,
    reopened,
    tellTravellerNow: false,
    sendDriverConfirmed: newOne && status === "confirmed" && (Boolean(removed) || a.hadRemovalBefore),
  };
}
