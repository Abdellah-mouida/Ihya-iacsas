import { auth } from "@/auth";
import { PageBackground } from "@/components/common/page-background";
import { About } from "@/components/sections/about";
import { Activities } from "@/components/sections/activities";
import { Branches } from "@/components/sections/branches";
import { CardCarousel } from "@/components/sections/card-carousel";
import { Contact } from "@/components/sections/contact";
import { Footer } from "@/components/sections/footer";
import { Gallery } from "@/components/sections/gallery";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { Hero } from "@/components/sections/hero";
import { Program } from "@/components/sections/program";

export default async function Home() {
  const session = await auth();
  return (
    <PageBackground variant="default">
      <GlassNavbar initialSession={session} />
      <main>
        <Hero />
        {/* Content sections with subtle ambient depth */}
        <div className="relative">
          <About />
          <Activities />
          <Branches />
          <CardCarousel />
          <Gallery />
          <Program />
          <Contact />
        </div>
      </main>
      <Footer />
    </PageBackground>
  );
}
