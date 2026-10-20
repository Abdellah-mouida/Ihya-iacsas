import { auth } from "@/auth";
import { getUserAccountData } from "@/app/actions/account";
import { SettingsView } from "@/components/settings/settings-view";
import { redirect } from "next/navigation";

export const metadata = {
  title: "الإعدادات | برنامج إحياء",
  description: "إعدادات الحساب والمظهر واللغة والخصوصية",
};

interface SettingsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/settings");
  }

  const res = await getUserAccountData();
  if (!res.success || !res.data) {
    redirect("/login?callbackUrl=/settings");
  }

  const initialData = res.data;

  const params = await searchParams;
  const initialTab = params?.tab || "profile";

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <SettingsView initialData={initialData} initialTab={initialTab} />
      </div>
    </main>
  );
}
