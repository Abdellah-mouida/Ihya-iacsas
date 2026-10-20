import { auth } from "@/auth";
import { getUserAccountData } from "@/app/actions/account";
import { ProfileView } from "@/components/profile/profile-view";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { redirect } from "next/navigation";

export const metadata = {
  title: "الملف الشخصي | برنامج إحياء",
  description: "الملف الشخصي والحجوزات والأنشطة",
};

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile");
  }

  const res = await getUserAccountData();
  if (!res.success || !res.data) {
    redirect("/login?callbackUrl=/profile");
  }

  const initialData = res.data;

  return (
    <>
      <GlassNavbar initialSession={session} />
      <main className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <ProfileView initialData={initialData} />
        </div>
      </main>
    </>
  );
}
