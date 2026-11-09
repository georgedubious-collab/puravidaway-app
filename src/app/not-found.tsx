import type { Metadata } from "next";
import { ErrorScreen } from "@/components/ErrorScreen";

export const metadata: Metadata = {
  title: "Page not found | PuraVidaWay",
};

export default function NotFound() {
  return (
    <ErrorScreen
      eyebrow="404 · Page not found"
      title="This road doesn't go anywhere"
      text="The page you were looking for has moved or never existed. Head back to the trip builder to plan your transfers, tours and stops."
      whatsAppMessage="Hi PuraVidaWay! I followed a link that didn't work. Can you help me with my Costa Rica trip?"
    />
  );
}
