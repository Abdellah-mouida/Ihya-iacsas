import type { Metadata } from "next";

import { auth } from "@/auth";
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
    <>
      <GlassNavbar initialSession={session} />
      <main>
        {/* Ambient radial-gradient backdrop, consistent with the homepage. */}
        <div className="relative bg-fixed bg-[radial-gradient(55%_45%_at_18%_12%,color-mix(in_oklch,var(--brass)_9%,transparent),transparent_60%),radial-gradient(50%_50%_at_85%_72%,color-mix(in_oklch,var(--emerald)_10%,transparent),transparent_65%)]">
          <EventsClientView />
        </div>
      </main>
      <Footer />
    </>
  );
}
