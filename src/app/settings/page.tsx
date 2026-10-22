import { auth } from "@/auth";
import { getUserAccountData } from "@/app/actions/account";
import { getCachedEnabledThemes } from "@/lib/theme-server";
import { SettingsView } from "@/components/settings/settings-view";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { Texture } from "@/components/common/texture";
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
  const availableThemes = await getCachedEnabledThemes();

  const params = await searchParams;
  const initialTab = params?.tab || "profile";

  return (
    <>
      <GlassNavbar initialSession={session} />
      <main className="relative isolate min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-background overflow-hidden z-0">
        <Texture pattern="octagon-tile" size={60} fade="vertical" />
        <div className="relative z-10 max-w-6xl mx-auto">
          <SettingsView
            initialData={initialData}
            initialTab={initialTab}
            availableThemes={availableThemes}
          />
        </div>
      </main>
    </>
  );
}
