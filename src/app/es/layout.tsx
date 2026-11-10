import { HtmlLang } from "@/components/site/HtmlLang";

/**
 * Spanish public pages (/es/…): the Spanish version of every public page (home,
 * route pages, info and legal pages; the list is in src/lib/publicLang.ts). The wrapper marks the content as Spanish in the server HTML; HtmlLang
 * also switches <html lang> once the page loads (the root layout is shared with
 * /admin and /driver and stays lang="en").
 */
export default function SpanishLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="es" className="flex-1 flex flex-col">
      <HtmlLang lang="es" />
      {children}
    </div>
  );
}
