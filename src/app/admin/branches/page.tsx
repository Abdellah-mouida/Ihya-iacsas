import { requirePermission } from "@/lib/permissions";
import { AdminBranchesView } from "@/components/admin/admin-branches-view";

export default async function AdminBranchesPage() {
  await requirePermission("branches:manage", { redirectOnFail: true });
  return <AdminBranchesView />;
}
