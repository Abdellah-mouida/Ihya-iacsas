import { auth } from "@/auth";
import { PageBackground } from "@/components/common/page-background";
import { About } from "@/components/sections/about";
import { Branches } from "@/components/sections/branches";
import { CardCarousel } from "@/components/sections/card-carousel";
import { Contact } from "@/components/sections/contact";
import { Footer } from "@/components/sections/footer";
import { Gallery } from "@/components/sections/gallery";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { Hero } from "@/components/sections/hero";
import { Program } from "@/components/sections/program";
import { getPublicBranches } from "@/lib/branches/public-data";
import deferred from "@/components/sections/home-deferred.module.css";

export default async function Home() {
  const [session, branches] = await Promise.all([auth(), getPublicBranches()]);
  return (
    <PageBackground variant="default">
      <GlassNavbar initialSession={session} />
      <main>
        <Hero />
        {/* Content sections with subtle ambient depth */}
        <div className="relative">
          <About branchCount={branches.length} />
          <div className={deferred.branches}><Branches branches={branches} /></div>
          <div className={deferred.carousel}><CardCarousel /></div>
          <div className={deferred.gallery}><Gallery /></div>
          <div className={deferred.program}><Program /></div>
          <Contact />
        </div>
      </main>
      <Footer branches={branches} />
    </PageBackground>
  );
}
