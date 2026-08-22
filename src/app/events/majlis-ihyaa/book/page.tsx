import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BookingStepper } from "@/components/common/booking-stepper";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { IMAGES } from "@/lib/content";

export const metadata: Metadata = {
  title: "حجز — مجالس إحياء | Ihyaa Booking",
  description: "Demo booking flow for the Ihyaa Majalis event (frontend only).",
};

export default function BookPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pattern-islamic absolute inset-0 -z-10 opacity-40" />
      <div className="bg-brass-gradient absolute -top-24 start-1/2 -z-10 size-72 -translate-x-1/2 rounded-full opacity-15 blur-3xl" />

      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 pt-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Ihyaa">
          <Image
            src={IMAGES.logoBanner}
            alt="Ihyaa"
            width={96}
            height={40}
            priority
            className="h-8 w-auto object-contain"
          />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="px-5 py-10 sm:py-14">
        <BookingStepper />
      </main>
    </div>
  );
}
