import { auth } from "@/auth";
import { getThemes } from "@/app/actions/themes";
import { AdminThemesView } from "@/components/admin/admin-themes-view";
import { redirect } from "next/navigation";

export const metadata = {
  title: "إدارة السمات | لوحة التحكم",
};

export default async function AdminThemesPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/403");
  }

  const themes = await getThemes();

  return <AdminThemesView initialThemes={themes} />;
}
