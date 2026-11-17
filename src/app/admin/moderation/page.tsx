import { can, requirePermission } from "@/lib/permissions";
import { listChatModerationDashboard } from "@/lib/chat/moderation";
import { AdminModerationView } from "@/components/admin/admin-moderation-view";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  const { role } = await requirePermission("chat:moderate", { redirectOnFail: true });
  const initialData = await listChatModerationDashboard({ status: "OPEN" });

  return (
    <AdminModerationView
      initialData={initialData}
      canManageSettings={can(role, "settings:manage")}
    />
  );
}
