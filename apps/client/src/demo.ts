import { createContext, useContext } from "react";
import type { PopularPrice } from "./prices";
import type { ChatMessage, Tour } from "./types";

/**
 * Sample data for the design previews (src/preview.tsx). In the real app this
 * is always null and every screen loads from the server.
 */
export interface Demo {
  popular?: Record<string, PopularPrice>;
  homeTours?: Tour[];
  chat?: ChatMessage[];
  /** Show the loading placeholders instead of content. */
  loading?: boolean;
  /** Places to show as search results. */
  found?: { placeId: string; main: string; secondary: string }[];
  /** The email a confirmation code was "sent" to. */
  codeSentTo?: string;
  /** Show the success screen as already paid. */
  paid?: boolean;
}

export const DemoContext = createContext<Demo | null>(null);
export const useDemo = () => useContext(DemoContext);
