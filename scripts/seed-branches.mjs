import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const cities = JSON.parse(readFileSync(new URL("../src/data/morocco/cities.json", import.meta.url), "utf8"));
const provinces = JSON.parse(readFileSync(new URL("../src/data/morocco/provinces.json", import.meta.url), "utf8"));

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) throw new Error("Cannot seed branches: create an ADMIN account first.");

  const city = (id) => {
    const found = cities.find((item) => item.id === id);
    if (!found) throw new Error(`Missing city ${id} from supplied cities.json`);
    return found;
  };
  const province = (id) => {
    const found = provinces.find((item) => item.id === id);
    if (!found) throw new Error(`Missing province ${id} from supplied provinces.json`);
    return found;
  };

  // Foum Zguid and Ouled Teima are approximate town-center points from GeoNames.
  // Foum Zguid: https://www.openstreetmap.org/node/1723404758 (30.08593, -6.87490)
  // Ouled Teima: https://www.geonames.org/6546458/oulad-teima.html (30.39467, -9.208968)
  const marrakech = city("marrakech");
  const taroudant = city("taroudant");
  const tataProvince = province("tata");
  const marrakechProvince = province("marrakech");
  const taroudantProvince = province("taroudannt");

  const rows = [
    {
      id: "branch-marrakech",
      kind: "CITY",
      geoId: marrakech.id,
      nameAr: marrakech.name.ar,
      nameEn: marrakech.name.en,
      regionId: marrakech.region,
      provinceId: marrakechProvince.id,
      latitude: marrakech.coordinates.latitude,
      longitude: marrakech.coordinates.longitude,
      sortOrder: 0,
    },
    {
      id: "branch-taroudant",
      kind: "CITY",
      geoId: taroudant.id,
      nameAr: taroudant.name.ar,
      nameEn: taroudant.name.en,
      regionId: taroudant.region,
      provinceId: taroudantProvince.id,
      latitude: taroudant.coordinates.latitude,
      longitude: taroudant.coordinates.longitude,
      sortOrder: 1,
    },
    {
      id: "branch-foum-zguid",
      kind: "CUSTOM",
      geoId: null,
      nameAr: "فم زكيد",
      nameEn: "Foum Zguid",
      regionId: tataProvince.region,
      provinceId: tataProvince.id,
      latitude: 30.08593,
      longitude: -6.8749,
      sortOrder: 2,
    },
    {
      id: "branch-ouled-teima",
      kind: "CUSTOM",
      geoId: null,
      nameAr: "أولاد تايمة",
      nameEn: "Ouled Teima",
      regionId: taroudantProvince.region,
      provinceId: taroudantProvince.id,
      latitude: 30.39467,
      longitude: -9.208968,
      sortOrder: 3,
    },
  ];

  await prisma.$transaction(
    rows.map((row) =>
      prisma.branch.upsert({
        where: { id: row.id },
        create: { ...row, createdById: admin.id },
        update: { ...row, createdById: admin.id },
      }),
    ),
  );
  console.info(`Seeded ${rows.length} branches idempotently.`);
}

main()
  .catch((error) => {
    console.error("Branch seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
