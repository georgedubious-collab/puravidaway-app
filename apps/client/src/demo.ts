import { createContext, useContext } from "react";
import type { PopularPrice, VehicleClass } from "./prices";
import type { ChatMessage, Tour } from "./types";

/**
 * Sample data for the design previews (src/preview.tsx). In the real app this
 * is always null and every screen loads from the server.
 */
export interface Demo {
  popular?: Record<string, PopularPrice>;
  homeTours?: Tour[];
  /** The vehicle types listed on the home screen ("Choose your ride"). */
  vehicles?: VehicleClass[];
  chat?: ChatMessage[];
  /** Preview only: show the chat as closed (read-only), with the "contact hidden" notice, or with a draft. */
  chatClosed?: boolean;
  chatNotice?: boolean;
  chatDraft?: string;
  /** Show the loading placeholders instead of content. */
  loading?: boolean;
  /** Places to show as search results. */
  found?: { placeId: string; main: string; secondary: string }[];
  /** The email a confirmation code was "sent" to. */
  codeSentTo?: string;
  /** Show the success screen as already paid. */
  paid?: boolean;
  /** Preview only: the rating panel with stars already tapped and words already typed. */
  rateStars?: number;
  rateComment?: string;
  /** Which side of the Explore tab to open on. */
  explore?: "rides" | "tours";
  /** Preview only: the car photo viewer open on this photo (0 = the main photo). */
  photoViewer?: number;
}

export const DemoContext = createContext<Demo | null>(null);
export const useDemo = () => useContext(DemoContext);
