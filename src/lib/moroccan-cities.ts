export type MoroccanCity = {
  id: string;
  nameAr: string;
  nameEn: string;
};

export const MOROCCAN_CITIES: MoroccanCity[] = [
  { id: "tetouan", nameAr: "تطوان", nameEn: "Tetouan" },
  { id: "tangier", nameAr: "طنجة", nameEn: "Tangier" },
  { id: "rabat", nameAr: "الرباط", nameEn: "Rabat" },
  { id: "casablanca", nameAr: "الدار البيضاء", nameEn: "Casablanca" },
  { id: "marrakech", nameAr: "مراكش", nameEn: "Marrakech" },
  { id: "fes", nameAr: "فاس", nameEn: "Fes" },
  { id: "agadir", nameAr: "أكادير", nameEn: "Agadir" },
  { id: "martil", nameAr: "مرتيل", nameEn: "Martil" },
  { id: "mdiq", nameAr: "المضيق", nameEn: "M'diq" },
  { id: "fnideq", nameAr: "الفنيدق", nameEn: "Fnideq" },
  { id: "chefchaouen", nameAr: "شفشاون", nameEn: "Chefchaouen" },
  { id: "larache", nameAr: "العرائش", nameEn: "Larache" },
  { id: "asilah", nameAr: "أصيلة", nameEn: "Asilah" },
  { id: "ksar-el-kebir", nameAr: "القصر الكبير", nameEn: "Ksar El Kebir" },
  { id: "al-hoceima", nameAr: "الحسيمة", nameEn: "Al Hoceima" },
  { id: "oujda", nameAr: "وجدة", nameEn: "Oujda" },
  { id: "nador", nameAr: "الناظور", nameEn: "Nador" },
  { id: "berkane", nameAr: "بركان", nameEn: "Berkane" },
  { id: "kenitra", nameAr: "القنيطرة", nameEn: "Kenitra" },
  { id: "sale", nameAr: "سلا", nameEn: "Salé" },
  { id: "temara", nameAr: "تمارة", nameEn: "Temara" },
  { id: "skhirat", nameAr: "الصخيرات", nameEn: "Skhirat" },
  { id: "mohammedia", nameAr: "المحمدية", nameEn: "Mohammedia" },
  { id: "el-jadida", nameAr: "الجديدة", nameEn: "El Jadida" },
  { id: "settat", nameAr: "سطات", nameEn: "Settat" },
  { id: "berrechid", nameAr: "برشيد", nameEn: "Berrechid" },
  { id: "meknes", nameAr: "مكناس", nameEn: "Meknes" },
  { id: "taza", nameAr: "تازة", nameEn: "Taza" },
  { id: "khemisset", nameAr: "الخميسات", nameEn: "Khemisset" },
  { id: "tifelt", nameAr: "تيفلت", nameEn: "Tifelt" },
  { id: "sidi-kacem", nameAr: "سيدي قاسم", nameEn: "Sidi Kacem" },
  { id: "sidi-slimane", nameAr: "سيدي سليمان", nameEn: "Sidi Slimane" },
  { id: "ouezzane", nameAr: "وزان", nameEn: "Ouezzane" },
  { id: "beni-mellal", nameAr: "بني ملال", nameEn: "Beni Mellal" },
  { id: "khouribga", nameAr: "خريبكة", nameEn: "Khouribga" },
  { id: "safi", nameAr: "آسفي", nameEn: "Safi" },
  { id: "essaouira", nameAr: "الصويرة", nameEn: "Essaouira" },
  { id: "khenifra", nameAr: "خنيفرة", nameEn: "Khenifra" },
  { id: "errachidia", nameAr: "الرشيدية", nameEn: "Errachidia" },
  { id: "ouarzazate", nameAr: "ورزازات", nameEn: "Ouarzazate" },
  { id: "taroudant", nameAr: "تارودانت", nameEn: "Taroudant" },
  { id: "tiznit", nameAr: "تيزنيت", nameEn: "Tiznit" },
  { id: "guelmim", nameAr: "كلميم", nameEn: "Guelmim" },
  { id: "tan-tan", nameAr: "طانطان", nameEn: "Tan-Tan" },
  { id: "sidi-ifni", nameAr: "سيدي إفني", nameEn: "Sidi Ifni" },
  { id: "laayoune", nameAr: "العيون", nameEn: "Laayoune" },
  { id: "dakhla", nameAr: "الداخلة", nameEn: "Dakhla" },
  { id: "boujdour", nameAr: "بوجدور", nameEn: "Boujdour" },
  { id: "smara", nameAr: "السمارة", nameEn: "Smara" },
  { id: "taourirt", nameAr: "تاوريرت", nameEn: "Taourirt" },
  { id: "guercif", nameAr: "جرسيف", nameEn: "Guercif" },
  { id: "driouch", nameAr: "الدريوش", nameEn: "Driouch" },
  { id: "midelt", nameAr: "ميدلت", nameEn: "Midelt" },
  { id: "azrou", nameAr: "أزرو", nameEn: "Azrou" },
  { id: "ifrane", nameAr: "إفران", nameEn: "Ifrane" },
  { id: "tinghir", nameAr: "تنغير", nameEn: "Tinghir" },
  { id: "zagora", nameAr: "زاكورة", nameEn: "Zagora" },
  { id: "ben-guerir", nameAr: "ابن جرير", nameEn: "Ben Guerir" },
  { id: "chichaoua", nameAr: "شيشاوة", nameEn: "Chichaoua" },
  { id: "youssoufia", nameAr: "اليوسفية", nameEn: "Youssoufia" },
  { id: "oulad-teima", nameAr: "أولاد تايمة", nameEn: "Oulad Teima" },
];

export function getCityDisplayName(cityIdOrName: string, locale: string = "ar"): string {
  const normalized = cityIdOrName.trim().toLowerCase();
  const found = MOROCCAN_CITIES.find(
    (c) =>
      c.id === normalized ||
      c.nameAr.toLowerCase() === normalized ||
      c.nameEn.toLowerCase() === normalized,
  );
  if (!found) return cityIdOrName;
  return locale === "ar" ? found.nameAr : found.nameEn;
}
