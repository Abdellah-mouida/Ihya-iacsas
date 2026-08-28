import { About } from "@/components/sections/about";
import { Activities } from "@/components/sections/activities";
import { Branches } from "@/components/sections/branches";
import { CardCarousel } from "@/components/sections/card-carousel";
import { Community } from "@/components/sections/community";
import { Contact } from "@/components/sections/contact";
import { Footer } from "@/components/sections/footer";
import { Gallery } from "@/components/sections/gallery";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { Hero } from "@/components/sections/hero";
import { WavesBackground } from "@/components/react-bits/waves-background";

export default function Home() {
  return (
    <>
      <GlassNavbar />
      <main>
        <Hero />
        {/* Ambient radial-gradient backdrop for the homepage — everything
            below the hero (the hero keeps its own photo background). */}
        <div className="relative bg-fixed bg-[radial-gradient(55%_45%_at_18%_12%,color-mix(in_oklch,var(--brass)_9%,transparent),transparent_60%),radial-gradient(50%_50%_at_85%_72%,color-mix(in_oklch,var(--emerald)_10%,transparent),transparent_65%)]">
          {/* React Bits "Waves" — slow, low-contrast flowing lines behind all
              post-hero sections for ambient depth. */}
          <WavesBackground />
          <About />
          <Activities />
          <Branches />
          <CardCarousel />
          <Gallery />
          <Community />
          <Contact />
        </div>
      </main>
      <Footer />
    </>
  );
}
