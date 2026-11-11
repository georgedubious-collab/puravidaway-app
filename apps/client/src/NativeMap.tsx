import type { ComponentType } from "react";
import type { RouteMapProps } from "./MapView";

/**
 * The real map only exists on phones (NativeMap.native.tsx). In a browser there
 * is none, so the app draws its own (see RouteMap in MapView.tsx).
 */
export const NativeMap: ComponentType<RouteMapProps> | null = null;
