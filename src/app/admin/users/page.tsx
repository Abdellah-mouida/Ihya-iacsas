"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Mail,
  MapPin,
  MoreVertical,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserCog,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import React, { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteOrAnonymizeUser,
  getAdminUsers,
  getUserAuditLogs,
  updateUserRole,
} from "@/app/actions/users";
import { IslamicLoader } from "@/components/common/islamic-loader";
import { RoleBadge } from "@/components/common/role-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/i18n/locale-provider";

type UserItem = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  role: "ADMIN" | "MODERATOR" | "USER";
  city: string | null;
  age: number | null;
  locale: string | null;
  bio?: string | null;
  studyLevel?: string | null;
  institution?: string | null;
  interests?: string[];
  skills?: string[];
  languages?: string[];
  volunteerAreas?: string[];
  lastLoginAt: Date | null;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  accounts: { provider: string }[];
  _count: {
    bookings: number;
    auditLogs: number;
  };
};

type AuditItem = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  actor: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
};

export default function AdminUsersPage() {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [users, setUsers] = useState<UserItem[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalModerators: 0,
    activeLast30Days: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<"ADMIN" | "MODERATOR" | "USER">("USER");
  const [roleReason, setRoleReason] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAction, setDeleteAction] = useState<"delete" | "anonymize">("anonymize");
  const [deleteReason, setDeleteReason] = useState("");

  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [userAuditLogs, setUserAuditLogs] = useState<AuditItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [isPending, startTransition] = useTransition();

  const fetchUsers = async (p = page, s = search, r = roleFilter, l = limit) => {
    try {
      setLoading(true);
      const res = await getAdminUsers({
        page: p,
        limit: l,
        search: s,
        role: r,
      });

      if (res.success) {
        setUsers(res.users as UserItem[]);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setPage(res.page);
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل تحميل المستخدمين" : "Failed to load users"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, search, roleFilter, limit);
  }, [roleFilter, limit]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1, search, roleFilter, limit);
  };

  const handleRoleChangeSubmit = () => {
    if (!selectedUser) return;
    startTransition(async () => {
      try {
        await updateUserRole({
          userId: selectedUser.id,
          newRole,
          reason: roleReason,
        });
        toast.success(t("adminUsers.roleUpdateSuccess"));
        setRoleDialogOpen(false);
        setRoleReason("");
        fetchUsers(page, search, roleFilter, limit);
      } catch (err: any) {
        toast.error(err.message || (isAr ? "فشل تحديث الدور" : "Failed to update role"));
      }
    });
  };

  const handleDeleteSubmit = () => {
    if (!selectedUser) return;
    startTransition(async () => {
      try {
        await deleteOrAnonymizeUser({
          userId: selectedUser.id,
          action: deleteAction,
          reason: deleteReason,
        });
        toast.success(t("adminUsers.userRemoveSuccess"));
        setDeleteDialogOpen(false);
        setDeleteReason("");
        fetchUsers(page, search, roleFilter, limit);
      } catch (err: any) {
        toast.error(err.message || (isAr ? "فشل إزالة المستخدم" : "Failed to remove user"));
      }
    });
  };

  const openDetailsDialog = async (u: UserItem) => {
    setSelectedUser(u);
    setDetailsDialogOpen(true);
    setLoadingAudit(true);
    try {
      const res = await getUserAuditLogs(u.id);
      if (res.success) {
        setUserAuditLogs(res.logs as AuditItem[]);
      }
    } catch (err) {
      setUserAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  const formatRelativeTime = (date: Date | null) => {
    if (!date) return t("adminUsers.neverActive");
    const d = new Date(date);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return t("adminUsers.justNow");
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
    return d.toLocaleDateString(isAr ? "ar-MA" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString(isAr ? "ar-MA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderRoleBadge = (role: "ADMIN" | "MODERATOR" | "USER") => {
    return <RoleBadge role={role} />;
  };

  return (
    <div
      data-testid="admin-users-page"
      className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="size-7 text-primary" />
            {t("adminUsers.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("adminUsers.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchUsers(page, search, roleFilter, limit)}
          disabled={loading}
          data-testid="users-refresh-btn"
          className="self-start sm:self-auto gap-2"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          {isAr ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 sm:p-5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              {t("adminUsers.statTotalUsers")}
            </span>
            <Users className="size-5 text-primary/70" />
          </div>
          <p
            data-testid="stat-total-users"
            className="text-2xl sm:text-3xl font-extrabold text-foreground mt-2"
          >
            {stats.totalUsers}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 sm:p-5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              {t("adminUsers.statAdmins")}
            </span>
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <p
            data-testid="stat-total-admins"
            className="text-2xl sm:text-3xl font-extrabold text-primary mt-2"
          >
            {stats.totalAdmins}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 sm:p-5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              {t("adminUsers.statModerators")}
            </span>
            <Shield className="size-5 text-emerald-500" />
          </div>
          <p
            data-testid="stat-total-moderators"
            className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2"
          >
            {stats.totalModerators}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 sm:p-5 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              {t("adminUsers.statActive30d")}
            </span>
            <Activity className="size-5 text-amber-500" />
          </div>
          <p
            data-testid="stat-active-30d"
            className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2"
          >
            {stats.activeLast30Days}
          </p>
        </motion.div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 rounded-2xl bg-card/40 backdrop-blur-md border border-border/60 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("adminUsers.searchPlaceholder")}
            data-testid="users-search-input"
            className="ps-9 pe-9 h-10 w-full rounded-xl bg-background/80"
          />
          <button type="submit" data-testid="users-search-submit" className="sr-only">
            {isAr ? "بحث" : "Search"}
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                fetchUsers(1, "", roleFilter, limit);
              }}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2.5">
          <Select
            value={roleFilter}
            onValueChange={(val) => {
              setRoleFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger
              data-testid="users-role-filter"
              className="w-40 h-10 rounded-xl bg-background/80"
            >
              <Filter className="size-3.5 me-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("adminUsers.filterRoleAll")}</SelectItem>
              <SelectItem value="ADMIN">{t("adminUsers.filterRoleAdmin")}</SelectItem>
              <SelectItem value="MODERATOR">
                {t("adminUsers.filterRoleModerator")}
              </SelectItem>
              <SelectItem value="USER">{t("adminUsers.filterRoleUser")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={String(limit)}
            onValueChange={(val) => {
              setLimit(Number(val));
              setPage(1);
            }}
          >
            <SelectTrigger
              data-testid="users-limit-filter"
              className="w-24 h-10 rounded-xl bg-background/80"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / p</SelectItem>
              <SelectItem value="20">20 / p</SelectItem>
              <SelectItem value="50">50 / p</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <IslamicLoader />
          <p className="text-sm text-muted-foreground mt-4">
            {isAr ? "جارٍ تحميل المستخدمين..." : "Loading users..."}
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-card/20 border border-border/40 p-8">
          <UserX className="size-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-base font-medium text-foreground">
            {t("adminUsers.noUsersFound")}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table
                data-testid="users-table"
                className="w-full text-start text-sm border-collapse"
              >
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="p-4 text-start">{t("adminUsers.colUser")}</th>
                    <th className="p-4 text-start">{t("adminUsers.colRole")}</th>
                    <th className="p-4 text-start">{t("adminUsers.colStatus")}</th>
                    <th className="p-4 text-start">{t("adminUsers.colLastActive")}</th>
                    <th className="p-4 text-start">{t("adminUsers.colJoined")}</th>
                    <th className="p-4 text-end">{t("adminUsers.colActions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {users.map((u) => {
                    const isSelf = u.id === currentUserId;
                    return (
                      <tr
                        key={u.id}
                        data-testid={`user-row-${u.id}`}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        {/* User identity */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              user={{
                                name: u.name,
                                email: u.email,
                                image: u.image,
                              }}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground truncate">
                                  {u.name || (isAr ? "مستخدم بدون اسم" : "Unnamed User")}
                                </span>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary font-bold">
                                    {isAr ? "أنت" : "You"}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground truncate block">
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="p-4">{renderRoleBadge(u.role)}</td>

                        {/* Status (Verification) */}
                        <td className="p-4">
                          {u.emailVerified ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              <Check className="size-3.5" />
                              {t("adminUsers.verified")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                              {t("adminUsers.unverified")}
                            </span>
                          )}
                        </td>

                        {/* Last Active */}
                        <td className="p-4 text-xs text-muted-foreground">
                          {formatRelativeTime(u.lastActiveAt)}
                        </td>

                        {/* Joined Date */}
                        <td className="p-4 text-xs text-muted-foreground">
                          {formatDate(u.createdAt)}
                        </td>

                        {/* Action Menu */}
                        <td className="p-4 text-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`user-actions-btn-${u.id}`}
                                className="size-8 rounded-lg"
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align={isAr ? "start" : "end"}
                              className="w-48"
                            >
                              <DropdownMenuItem
                                data-testid={`view-user-${u.id}`}
                                onClick={() => openDetailsDialog(u)}
                                className="gap-2 cursor-pointer"
                              >
                                <Eye className="size-4 text-muted-foreground" />
                                {t("adminUsers.viewDetails")}
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                data-testid={`edit-role-${u.id}`}
                                onClick={() => {
                                  setSelectedUser(u);
                                  setNewRole(u.role);
                                  setRoleDialogOpen(true);
                                }}
                                disabled={isSelf}
                                className="gap-2 cursor-pointer"
                              >
                                <UserCog className="size-4 text-muted-foreground" />
                                {t("adminUsers.changeRole")}
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                data-testid={`delete-user-${u.id}`}
                                onClick={() => {
                                  setSelectedUser(u);
                                  setDeleteAction("anonymize");
                                  setDeleteDialogOpen(true);
                                }}
                                disabled={isSelf}
                                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="size-4" />
                                {t("adminUsers.deleteUser")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View (down to 320px) */}
          <div data-testid="users-cards-mobile" className="grid grid-cols-1 gap-3 md:hidden">
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <div
                  key={u.id}
                  data-testid={`user-card-${u.id}`}
                  className="p-4 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        user={{
                          name: u.name,
                          email: u.email,
                          image: u.image,
                        }}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-foreground text-sm truncate">
                            {u.name || (isAr ? "مستخدم بدون اسم" : "Unnamed User")}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-primary/10 text-primary font-bold">
                              {isAr ? "أنت" : "You"}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">
                          {u.email}
                        </span>
                      </div>
                    </div>
                    <div>{renderRoleBadge(u.role)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/40 text-muted-foreground">
                    <div>
                      <span className="block font-medium text-foreground/80">
                        {t("adminUsers.colStatus")}
                      </span>
                      <span>
                        {u.emailVerified
                          ? t("adminUsers.verified")
                          : t("adminUsers.unverified")}
                      </span>
                    </div>
                    <div>
                      <span className="block font-medium text-foreground/80">
                        {t("adminUsers.colLastActive")}
                      </span>
                      <span>{formatRelativeTime(u.lastActiveAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetailsDialog(u)}
                      className="text-xs h-8 px-2.5 gap-1.5"
                    >
                      <Eye className="size-3.5" />
                      {t("adminUsers.viewDetails")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSelf}
                      onClick={() => {
                        setSelectedUser(u);
                        setNewRole(u.role);
                        setRoleDialogOpen(true);
                      }}
                      className="text-xs h-8 px-2.5 gap-1.5"
                    >
                      <UserCog className="size-3.5" />
                      {t("adminUsers.changeRole")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isSelf}
                      onClick={() => {
                        setSelectedUser(u);
                        setDeleteAction("anonymize");
                        setDeleteDialogOpen(true);
                      }}
                      className="text-xs h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/40">
            <span className="text-xs text-muted-foreground">
              {t("adminUsers.pageOf")
                .replace("{page}", String(page))
                .replace("{total}", String(totalPages))}{" "}
              ({total} {isAr ? "مستخدم" : "users"})
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="users-prev-page"
                onClick={() => fetchUsers(page - 1, search, roleFilter, limit)}
                disabled={page <= 1 || loading}
                className="gap-1.5 h-8 text-xs rounded-xl"
              >
                {isAr ? (
                  <ChevronRight className="size-3.5" />
                ) : (
                  <ChevronLeft className="size-3.5" />
                )}
                {t("adminUsers.pagePrev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="users-next-page"
                onClick={() => fetchUsers(page + 1, search, roleFilter, limit)}
                disabled={page >= totalPages || loading}
                className="gap-1.5 h-8 text-xs rounded-xl"
              >
                {t("adminUsers.pageNext")}
                {isAr ? (
                  <ChevronLeft className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent
          data-testid="role-change-dialog"
          className="sm:max-w-md rounded-2xl"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserCog className="size-5 text-primary" />
              {t("adminUsers.roleModalTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("adminUsers.roleModalDesc").replace(
                "{name}",
                selectedUser?.name || selectedUser?.email || "",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground/80">
                {t("adminUsers.colRole")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["USER", "MODERATOR", "ADMIN"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    data-testid={`select-role-${r.toLowerCase()}`}
                    onClick={() => setNewRole(r)}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                      newRole === r
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                        : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {r === "ADMIN" ? (
                      <ShieldCheck className="size-4" />
                    ) : r === "MODERATOR" ? (
                      <Shield className="size-4" />
                    ) : (
                      <User className="size-4" />
                    )}
                    <span className="text-xs">
                      {r === "ADMIN"
                        ? t("adminUsers.roleAdmin")
                        : r === "MODERATOR"
                          ? t("adminUsers.roleModerator")
                          : t("adminUsers.roleUser")}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80">
                {t("adminUsers.roleModalReason")}
              </label>
              <Input
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                placeholder={isAr ? "مثال: ترقية للمساهمة في إدارة المخيمات" : "e.g., promoted to manage events"}
                data-testid="role-change-reason"
                className="h-10 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              className="rounded-xl"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              data-testid="role-change-submit"
              onClick={handleRoleChangeSubmit}
              disabled={isPending || newRole === selectedUser?.role}
              className="rounded-xl"
            >
              {isPending
                ? t("adminUsers.roleModalUpdating")
                : t("adminUsers.roleModalSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Anonymize Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent
          data-testid="user-delete-dialog"
          className="sm:max-w-md rounded-2xl"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" />
              {t("adminUsers.deleteModalTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("adminUsers.deleteModalDesc").replace(
                "{name}",
                selectedUser?.name || selectedUser?.email || "",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div
                onClick={() => setDeleteAction("anonymize")}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  deleteAction === "anonymize"
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <div
                    className={`size-4 rounded-full border flex items-center justify-center ${
                      deleteAction === "anonymize"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground"
                    }`}
                  >
                    {deleteAction === "anonymize" && <div className="size-1.5 rounded-full bg-background" />}
                  </div>
                  <span>{t("adminUsers.anonymize")}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ps-6">
                  {t("adminUsers.deleteOptionAnonymize")}
                </p>
              </div>

              <div
                onClick={() => setDeleteAction("delete")}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  deleteAction === "delete"
                    ? "border-destructive bg-destructive/10"
                    : "border-border/60 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-destructive">
                  <div
                    className={`size-4 rounded-full border flex items-center justify-center ${
                      deleteAction === "delete"
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : "border-muted-foreground"
                    }`}
                  >
                    {deleteAction === "delete" && <div className="size-1.5 rounded-full bg-background" />}
                  </div>
                  <span>{t("adminUsers.deleteUser")}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ps-6">
                  {t("adminUsers.deleteOptionPermanent")}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80">
                {t("adminUsers.deleteModalReason")}
              </label>
              <Input
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder={isAr ? "مثال: طلب حذف الحساب أو انتهاك الشروط" : "e.g., requested account deletion"}
                data-testid="user-delete-reason"
                className="h-10 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded-xl"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              data-testid="user-delete-confirm"
              onClick={handleDeleteSubmit}
              disabled={isPending}
              className="rounded-xl"
            >
              {isPending
                ? t("adminUsers.deleteModalProcessing")
                : t("adminUsers.deleteModalConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Details & Audit History Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent
          data-testid="user-details-dialog"
          className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Eye className="size-5 text-primary" />
              {t("adminUsers.detailsModalTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("adminUsers.detailsModalSub")}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6 py-2">
              {/* Profile Card */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-4">
                <UserAvatar
                  user={{
                    name: selectedUser.name,
                    email: selectedUser.email,
                    image: selectedUser.image,
                  }}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-foreground text-base">
                      {selectedUser.name || (isAr ? "مستخدم بدون اسم" : "Unnamed User")}
                    </h3>
                    {renderRoleBadge(selectedUser.role)}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {selectedUser.email}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1 font-mono">
                    ID: {selectedUser.id}
                  </p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">
                    {t("adminUsers.detailsCity")}
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {selectedUser.city || "—"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">
                    {t("adminUsers.detailsAge")}
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {selectedUser.age ? `${selectedUser.age} ${isAr ? "سنة" : "y/o"}` : "—"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">
                    {t("adminUsers.detailsBookings")}
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {selectedUser._count.bookings}{" "}
                    {isAr ? "حجوزات" : "bookings"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">
                    {t("adminUsers.detailsProvider")}
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block capitalize">
                    {selectedUser.accounts.length > 0
                      ? selectedUser.accounts.map((a) => a.provider).join(", ")
                      : "Credentials"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">
                    {t("adminUsers.detailsLastLogin")}
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {formatDate(selectedUser.lastLoginAt)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <span className="text-muted-foreground block text-[11px]">
                    {t("adminUsers.colJoined")}
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {formatDate(selectedUser.createdAt)}
                  </span>
                </div>
              </div>

              {/* Optional Profile Details (Task 9) */}
              <div data-testid="admin-user-optional-details">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  {t("adminUsers.detailsOptionalHeading")}
                </h4>
                {selectedUser.bio ||
                selectedUser.studyLevel ||
                selectedUser.institution ||
                (selectedUser.interests && selectedUser.interests.length > 0) ||
                (selectedUser.skills && selectedUser.skills.length > 0) ||
                (selectedUser.languages && selectedUser.languages.length > 0) ||
                (selectedUser.volunteerAreas && selectedUser.volunteerAreas.length > 0) ? (
                  <div className="space-y-3 p-3.5 rounded-xl bg-card border border-border/60 text-xs">
                    {selectedUser.bio && (
                      <div>
                        <span className="text-[11px] text-muted-foreground block font-medium">
                          {t("adminUsers.detailsBio")}
                        </span>
                        <p className="mt-1 text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-2.5 rounded-lg border border-border/40">
                          {selectedUser.bio}
                        </p>
                      </div>
                    )}

                    {(selectedUser.studyLevel || selectedUser.institution) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/40">
                        {selectedUser.studyLevel && (
                          <div>
                            <span className="text-[11px] text-muted-foreground block font-medium">
                              {t("adminUsers.detailsStudy")}
                            </span>
                            <span className="font-semibold text-foreground block mt-0.5">
                              {selectedUser.studyLevel}
                            </span>
                          </div>
                        )}
                        {selectedUser.institution && (
                          <div>
                            <span className="text-[11px] text-muted-foreground block font-medium">
                              {t("adminUsers.detailsInstitution")}
                            </span>
                            <span className="font-semibold text-foreground block mt-0.5">
                              {selectedUser.institution}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedUser.interests && selectedUser.interests.length > 0 && (
                      <div className="pt-1 border-t border-border/40">
                        <span className="text-[11px] text-muted-foreground block font-medium mb-1">
                          {t("adminUsers.detailsInterests")}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUser.interests.map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedUser.skills && selectedUser.skills.length > 0 && (
                      <div className="pt-1 border-t border-border/40">
                        <span className="text-[11px] text-muted-foreground block font-medium mb-1">
                          {t("adminUsers.detailsSkills")}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUser.skills.map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[11px]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedUser.languages && selectedUser.languages.length > 0 && (
                      <div className="pt-1 border-t border-border/40">
                        <span className="text-[11px] text-muted-foreground block font-medium mb-1">
                          {t("adminUsers.detailsLanguages")}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUser.languages.map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[11px]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedUser.volunteerAreas && selectedUser.volunteerAreas.length > 0 && (
                      <div className="pt-1 border-t border-border/40">
                        <span className="text-[11px] text-muted-foreground block font-medium mb-1">
                          {t("adminUsers.detailsVolunteer")}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUser.volunteerAreas.map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[11px]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    {t("adminUsers.detailsNoOptional")}
                  </div>
                )}
              </div>

              {/* Audit Trail */}
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Activity className="size-3.5 text-primary" />
                  {t("adminUsers.detailsAuditTrail")}
                </h4>

                {loadingAudit ? (
                  <div className="py-6 flex justify-center">
                    <IslamicLoader />
                  </div>
                ) : userAuditLogs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    {t("adminUsers.detailsNoAudit")}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pe-1">
                    {userAuditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-xs flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground block truncate">
                            {log.action}
                          </span>
                          <span className="text-[11px] text-muted-foreground block truncate">
                            by: {log.actor?.name || log.actor?.email || "System"} (
                            {log.actor?.role || "SYSTEM"})
                          </span>
                          {log.details && (
                            <span className="text-[10px] text-muted-foreground/80 font-mono block truncate mt-0.5">
                              {typeof log.details === "string"
                                ? log.details
                                : JSON.stringify(log.details)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailsDialogOpen(false)}
              className="rounded-xl w-full"
            >
              {isAr ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
