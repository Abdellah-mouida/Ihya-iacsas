import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";
import { BookingFallback } from "@/components/common/booking-fallback";
import { BookingStepper } from "@/components/common/booking-stepper";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { PageTexture } from "@/components/common/page-texture";
import { IMAGES } from "@/lib/content";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "حجز — برنامج إحياء | Ihyaa Booking",
  description: "Booking page for Ihyaa Program events.",
};

export default async function BookPage({
  searchParams,
}: {
  searchParams?: Promise<{ eventId?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const currentPath = params?.eventId
    ? `/book?eventId=${encodeURIComponent(params.eventId)}`
    : "/book";

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
  }
  if (!session.user.onboardingComplete) {
    redirect(`/onboarding?callbackUrl=${encodeURIComponent(currentPath)}`);
  }

  const cookieStore = await cookies();

  let targetEventId = params?.eventId;
  const event = targetEventId
    ? await prisma.event.findFirst({
        where: {
          OR: [{ id: targetEventId }, { slug: targetEventId }],
        },
        select: { id: true, slug: true },
      })
    : await prisma.event.findFirst({
        where: { bookingOpen: true },
        orderBy: { date: "asc" },
        select: { id: true, slug: true },
      });

  targetEventId = event?.slug || event?.id || targetEventId || "majlis-ihyaa";

  const headerList = await headers();
  const isServerAction = headerList.has("next-action");

  if (!isServerAction && event) {
    const existing = await prisma.booking.findFirst({
      where: {
        eventId: event.id,
        OR: [
          { userId: session.user.id },
          { email: session.user.email! },
        ],
      },
    });
    if (existing) {
      redirect(`/events#event-${targetEventId}`);
    }
  }

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
    <div className="relative isolate min-h-dvh overflow-hidden bg-background z-0">
      <PageTexture />
      <div className="bg-brass-gradient absolute -top-24 start-1/2 z-[1] size-72 -translate-x-1/2 rounded-full opacity-15 blur-3xl pointer-events-none" />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-5 pt-6">
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
        <Suspense fallback={<BookingFallback />}>
          <BookingStepper initialEventId={targetEventId} />
        </Suspense>
      </main>
    </div>
  );
}
