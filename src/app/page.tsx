import { About } from "@/components/sections/about";
import { Activities } from "@/components/sections/activities";
import { Branches } from "@/components/sections/branches";
import { Community } from "@/components/sections/community";
import { Contact } from "@/components/sections/contact";
import { FeaturedEvent } from "@/components/sections/featured-event";
import { Footer } from "@/components/sections/footer";
import { Gallery } from "@/components/sections/gallery";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { Hero } from "@/components/sections/hero";

export default function Home() {
  return (
    <>
      <GlassNavbar />
      <main>
        <Hero />
        <About />
        <Activities />
        <FeaturedEvent />
        <Branches />
        <Gallery />
        <Community />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
