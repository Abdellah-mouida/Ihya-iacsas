import type { Metadata } from "next";

import { auth } from "@/auth";
import { PageBackground } from "@/components/common/page-background";
import { EventsClientView } from "@/components/sections/events-client-view";
import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";

export const metadata: Metadata = {
  title: "الفعاليات — إحياء | Ihyaa Events",
  description:
    "فعاليات برنامج إحياء الشبابي القادمة والسابقة. Upcoming and past gatherings of the Ihyaa youth program.",
};

export default async function EventsPage() {
  const session = await auth();
  return (
    <PageBackground variant="content">
      <GlassNavbar initialSession={session} />
      <main className="relative">
        <EventsClientView />
      </main>
      <Footer />
    </PageBackground>
  );
}
