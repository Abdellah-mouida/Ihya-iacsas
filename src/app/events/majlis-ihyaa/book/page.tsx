import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BookingStepper } from "@/components/common/booking-stepper";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { IMAGES } from "@/lib/content";

export const metadata: Metadata = {
  title: "حجز — مجالس إحياء | Ihyaa Booking",
  description: "Booking flow for the Ihyaa Majalis event.",
};

export default function BookPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pattern-islamic absolute inset-0 -z-10" />
      <div className="bg-brass-gradient absolute -top-24 start-1/2 -z-10 size-72 -translate-x-1/2 rounded-full opacity-15 blur-3xl" />

      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 pt-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Ihyaa">
          <span className="relative shrink-0">
            <Image
              src={IMAGES.logoSquare}
              alt="Ihyaa"
              width={40}
              height={40}
              priority
              className="size-10 rounded-full object-cover ring-1 ring-brass/40 transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/20" />
          </span>
          <span className="font-heading text-xl font-bold text-foreground">
            إحياء
          </span>
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
