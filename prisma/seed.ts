import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Seed Carousel Posts
  const carouselCount = await prisma.carouselPost.count();
  if (carouselCount === 0) {
    await prisma.carouselPost.createMany({
      data: [
        {
          imageUrl: "/images/cards/night-card.jpg",
          order: 0,
          active: true,
        },
        {
          imageUrl: "/images/cards/journey-card.jpg",
          order: 1,
          active: true,
        },
        {
          imageUrl: "/images/cards/quote-card.jpg",
          order: 2,
          active: true,
        },
      ],
    });
    console.log("Seeded initial Carousel Posts.");
  }

  // 2. Seed Gallery Photos
  const galleryCount = await prisma.galleryPhoto.count();
  if (galleryCount === 0) {
    await prisma.galleryPhoto.createMany({
      data: [
        {
          imageUrl: "/images/gathering.jpg",
          captionAr: "لحظات إيمانية وأخوية في لقاء شبابي مبارك",
          captionEn: "Spiritual and brotherly moments in a blessed youth gathering",
        },
        {
          imageUrl: "/images/prayer.jpg",
          captionAr: "جلسة تضرع ودعاء واستغفار في جو من السكينة",
          captionEn: "A session of supplication, prayer, and tranquility",
        },
        {
          imageUrl: "/images/group-portrait.jpg",
          captionAr: "صورة جماعية لشباب إحياء في ختام اللقاء السنوي",
          captionEn: "Group photo of Ihyaa youth at the conclusion of the annual retreat",
        },
        {
          imageUrl: "/images/football.jpg",
          captionAr: "منافسات رياضية وروح أخوية في دوري كرة القدم",
          captionEn: "Sports tournament and fraternal spirit in the football cup",
        },
      ],
    });
    console.log("Seeded initial Gallery Photos.");
  }

  // 3. Seed Events
  const eventCount = await prisma.event.count();
  if (eventCount === 0) {
    const upcomingEvent = await prisma.event.create({
      data: {
        id: "majlis-ihyaa-2026",
        titleAr: "مجلس إحياء الشبابي — الدورة الربيعية",
        titleEn: "Ihyaa Youth Council — Spring Session",
        descriptionAr: "لقاء إيماني وثقافي يجمع شباب الأمة على موائد القرآن والتزكية وبناء الشخصية المسلمة الرائدة.",
        descriptionEn: "A spiritual and cultural gathering bringing together youth around Quran, purification, and building leading Muslim personalities.",
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        time: "18:00 - 21:00",
        location: "المركب الثقافي، مراكش",
        posterUrl: "/images/event-poster.jpg",
        isNew: true,
        bookingOpen: true,
      },
    });

    await prisma.event.createMany({
      data: [
        {
          id: "past-winter-retreat",
          titleAr: "الملتقى الشتوي للشباب 2025",
          titleEn: "Winter Youth Retreat 2025",
          descriptionAr: "ثلاثة أيام من التكوين والرياضة والأخوة الصادقة في أحضان الطبيعة.",
          descriptionEn: "Three days of development, sports, and sincere brotherhood in nature.",
          date: new Date("2025-12-25T10:00:00Z"),
          time: "10:00 - 18:00",
          location: "تارودانت",
          posterUrl: "/images/group-portrait.jpg",
          isNew: false,
          bookingOpen: false,
        },
        {
          id: "past-football-cup",
          titleAr: "دوري الأخوة لكرة القدم",
          titleEn: "Brotherhood Football Tournament",
          descriptionAr: "دوري رياضي تنافسي يجمع فروع إحياء بمختلف المدن.",
          descriptionEn: "A competitive sports tournament bringing together Ihyaa branches from various cities.",
          date: new Date("2025-11-15T15:00:00Z"),
          time: "15:00 - 19:00",
          location: "أولاد تايمة",
          posterUrl: "/images/football.jpg",
          isNew: false,
          bookingOpen: false,
        },
        {
          id: "past-gathering-retreat",
          titleAr: "مجلس مدارسة السيرة النبوية",
          titleEn: "Prophetic Biography Study Circle",
          descriptionAr: "جلسة إيمانية حول دروس وعبر من السيرة العطرة في واقع الشباب المعاصر.",
          descriptionEn: "Spiritual circle on lessons from the Prophetic biography in modern youth life.",
          date: new Date("2025-10-10T17:00:00Z"),
          time: "17:00 - 20:00",
          location: "فم زكيد",
          posterUrl: "/images/gathering.jpg",
          isNew: false,
          bookingOpen: false,
        },
      ],
    });

    // 4. Seed sample bookings for the upcoming event
    await prisma.booking.createMany({
      data: [
        {
          eventId: upcomingEvent.id,
          fullName: "حمزة بناني",
          email: "hamza.bennani@example.com",
          phone: "0661234567",
        },
        {
          eventId: upcomingEvent.id,
          fullName: "عمر السملالي",
          email: "omar.semlali@example.com",
          phone: "0669876543",
        },
        {
          eventId: upcomingEvent.id,
          fullName: "ياسين التازي",
          email: "yassine.tazi@example.com",
          phone: "0664567890",
        },
      ],
    });
    console.log("Seeded Events and sample Bookings.");
  }

  console.log("Seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
