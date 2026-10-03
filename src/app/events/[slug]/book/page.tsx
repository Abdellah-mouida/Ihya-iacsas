import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BookingStepper } from "@/components/common/booking-stepper";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { IMAGES } from "@/lib/content";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "حجز — مجالس إحياء | Ihyaa Booking",
  description: "Booking flow for Ihyaa events.",
};

export default async function EventBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ eventId?: string }>;
}) {
  const { slug } = await params;
  const sParams = searchParams ? await searchParams : {};
  const cookieStore = await cookies();

  let targetEventId = sParams?.eventId || slug;

  // Resolve event from database if needed
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: targetEventId },
        { id: { startsWith: targetEventId } },
        { id: { contains: targetEventId } },
      ],
    },
    select: { id: true, bookingOpen: true },
  });

  if (event) {
    targetEventId = event.id;
  }

  // Server-side check: if already booked cookie exists, redirect to event page (except during Server Action)
  const headerList = await headers();
  const isServerAction = headerList.has("next-action");

  const hasEventCookie = cookieStore.get(`ihyaa_booked_${targetEventId}`)?.value === "true";
  let hasListCookie = false;
  const bookedListRaw = cookieStore.get("ihyaa_booked_events")?.value;
  if (bookedListRaw) {
    try {
      const list = JSON.parse(decodeURIComponent(bookedListRaw));
      if (Array.isArray(list) && list.includes(targetEventId)) {
        hasListCookie = true;
      }
    } catch {}
  }

  if (!isServerAction && (hasEventCookie || hasListCookie)) {
    redirect(`/events#event-${targetEventId}`);
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pattern-islamic absolute inset-0 -z-10" />
      <div className="bg-brass-gradient absolute -top-24 start-1/2 -z-10 size-72 -translate-x-1/2 rounded-full opacity-15 blur-3xl" />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Ihyaa">
          <span className="relative shrink-0">
            <Image
              src={IMAGES.logoCircle}
              alt="Ihyaa"
              width={40}
              height={40}
              priority
              className="size-10 object-contain transition-transform duration-300 group-hover:scale-105"
            />
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

      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
        <Suspense fallback={<div className="text-center py-10 font-amiri text-muted-foreground">جاري التحميل...</div>}>
          <BookingStepper initialEventId={targetEventId} />
        </Suspense>
      </main>
    </div>
  );
}
