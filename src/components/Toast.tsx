"use client";

import { CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(t);
  }, [message]);
  return { message, show: setMessage };
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 left-5 sm:left-auto bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 z-[60]"
    >
      <CheckCircle className="w-4 h-4 text-emerald-400" />
      <span>{message}</span>
    </div>
  );
}
