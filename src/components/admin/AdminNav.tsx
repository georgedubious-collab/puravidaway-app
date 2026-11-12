"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { Icon, type IconName } from "./ui";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Things that need attention here; 0 shows nothing. */
  count: number;
  /** Read out with the number, e.g. "3 bookings need action". */
  countLabel: string;
}

function isCurrent(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The admin's dark-green side menu. From large screens up it stays on the left; on phones and
 * tablets it hides behind a ☰ button and opens as a panel: focus stays inside it, Escape or
 * the × closes it, and focus goes back to the ☰ button.
 */
export function AdminNav({
  items,
  footer,
  menuLabel,
  closeLabel,
}: {
  items: NavItem[];
  /** Language switch, signed-in email and sign out (rendered on the server). */
  footer: React.ReactNode;
  menuLabel: string;
  closeLabel: string;
}) {
  const pathname = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
  }, []);

  // Moving to another page closes the panel.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a[aria-current=page], a, button")?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const f = Array.from(panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex='-1'])"));
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  const brand = (
    <Link href="/admin" className="flex items-center gap-2.5 rounded-lg px-2 py-1 focus-visible:outline-2 focus-visible:outline-[#F5B301]">
      <LogoMark badge className="h-9 w-9 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="font-extrabold text-white">Private Transfers</span>
        <span className="text-[11px] font-extrabold tracking-[0.1em] text-[#F5B301]">ADMIN</span>
      </span>
    </Link>
  );

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-0.5">
      {items.map((n) => {
        const on = isCurrent(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-[#F5B301] ${
              on ? "bg-[#154A37] text-white" : "text-[#C9E0D5] hover:bg-[#133D2E] hover:text-white"
            }`}
          >
            <Icon name={n.icon} className={`h-[18px] w-[18px] shrink-0 ${on ? "text-[#F5B301]" : "text-[#8FB8A6]"}`} />
            <span className="grow">{n.label}</span>
            {n.count > 0 && (
              <span className="min-w-[22px] rounded-full bg-[#F5B301] px-1.5 py-px text-center text-xs font-extrabold text-[#3A2A00]">
                <span aria-hidden>{n.count}</span>
                <span className="sr-only">{n.countLabel}</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const body = (
    <>
      {nav}
      <div className="mt-auto flex flex-col gap-2.5 border-t border-[#1F4A3A] px-2 pt-3">{footer}</div>
    </>
  );

  return (
    <>
      {/* Phones and tablets: a top bar with the ☰ button. */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-[#0B2E22] px-3 py-2 lg:hidden">
        {brand}
        <button
          ref={openerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-menu-panel"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-[#2C5C4A] px-3 text-sm font-bold text-[#D6E9DF] focus-visible:outline-2 focus-visible:outline-[#F5B301]"
        >
          <Icon name="menu" className="h-5 w-5" />
          <span>{menuLabel}</span>
          {items.some((n) => n.count > 0) && <span aria-hidden className="h-2 w-2 rounded-full bg-[#F5B301]" />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" tabIndex={-1} aria-hidden onClick={close} className="absolute inset-0 h-full w-full cursor-default bg-black/45" />
          <div
            ref={panelRef}
            id="admin-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label={menuLabel}
            className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col gap-4 overflow-y-auto bg-[#0B2E22] px-3.5 py-4 text-[#D6E9DF] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              {brand}
              <button
                type="button"
                onClick={close}
                aria-label={closeLabel}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[#D6E9DF] hover:bg-[#133D2E] focus-visible:outline-2 focus-visible:outline-[#F5B301]"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
            {body}
          </div>
        </div>
      )}

      {/* Large screens: the menu stays on the left. */}
      <div className="hidden w-[248px] shrink-0 bg-[#0B2E22] lg:block">
        <aside className="sticky top-0 flex h-screen flex-col gap-5 overflow-y-auto px-3.5 py-5 text-[#D6E9DF]">
          {brand}
          {body}
        </aside>
      </div>
    </>
  );
}
