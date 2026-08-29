import type { Metadata } from "next";

import { EventsHeader } from "@/components/sections/events-header";
import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { OpenEvents } from "@/components/sections/open-events";
import { PastEvents } from "@/components/sections/past-events";
import { WavesBackground } from "@/components/react-bits/waves-background";

export const metadata: Metadata = {
  title: "الفعاليات — إحياء | Ihyaa Events",
  description:
    "فعاليات برنامج إحياء الشبابي القادمة والسابقة. Upcoming and past gatherings of the Ihyaa youth program.",
};

export default function EventsPage() {
  return (
    <>
      <GlassNavbar />
      <main>
        {/* Ambient radial-gradient backdrop, consistent with the homepage. */}
        <div className="relative bg-fixed bg-[radial-gradient(55%_45%_at_18%_12%,color-mix(in_oklch,var(--brass)_9%,transparent),transparent_60%),radial-gradient(50%_50%_at_85%_72%,color-mix(in_oklch,var(--emerald)_10%,transparent),transparent_65%)]">
          <WavesBackground />
          <EventsHeader />
          <OpenEvents />
          <PastEvents />
        </div>
      </main>
      <Footer />
    </>
  );
}
