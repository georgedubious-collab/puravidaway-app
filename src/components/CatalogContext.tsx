"use client";

import { createContext, useContext } from "react";
import { BUILT_IN_CATALOG, type CatalogData } from "@/lib/catalogModel";

const CatalogContext = createContext<CatalogData>(BUILT_IN_CATALOG);

export function CatalogProvider({
  catalog,
  children,
}: {
  catalog: CatalogData;
  children: React.ReactNode;
}) {
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

/** The live catalog (database prices when connected, built-in otherwise). */
export function useCatalog(): CatalogData {
  return useContext(CatalogContext);
}
