import { AdminLogsView } from "@/app/admin/logs/logs-view";
import { requirePermission } from "@/lib/permissions";

export default async function AdminLogsPage() {
  await requirePermission("audit:view");
  return <AdminLogsView />;
}
