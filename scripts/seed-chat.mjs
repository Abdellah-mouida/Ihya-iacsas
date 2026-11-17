import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const pub = await prisma.conversation.upsert({
    where: { publicKey: "PUBLIC" },
    update: {},
    create: {
      type: "PUBLIC",
      publicKey: "PUBLIC",
      name: "Public Space",
      membersCanInvite: false,
      memberCap: 100000,
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: "chatEnabled" },
    update: {},
    create: {
      key: "chatEnabled",
      value: "false",
    },
  });

  console.log(`Seeded PUBLIC conversation: ${pub.id}`);
}

main()
  .catch((error) => {
    console.error("Failed to seed chat:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
