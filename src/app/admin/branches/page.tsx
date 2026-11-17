import { requirePermission } from "@/lib/permissions";
import { AdminBranchesView } from "@/components/admin/admin-branches-view";

export default async function AdminBranchesPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  await requirePermission("branches:manage", { redirectOnFail: true });
  const { branch } = await searchParams;
  return <AdminBranchesView focusBranchId={branch} />;
}
