import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminLayoutClient } from "@/components/admin/admin-layout-client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/admin")}`);
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR") {
    redirect("/403");
  }

  return (
    <AdminLayoutClient
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: session.user.role,
      }}
    >
      {children}
    </AdminLayoutClient>
  );
}
