"use client";

import Image from "next/image";
import Link from "next/link";

import { OrnamentDivider } from "@/components/common/ornament-divider";
import { useLocale } from "@/i18n/locale-provider";
import { BRANCHES, EVENT, IMAGES, NAV_LINKS } from "@/lib/content";

export function Footer() {
  const { t } = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-border/60 bg-card/50 pt-16 pb-8">
      <div className="pattern-islamic absolute inset-0 -z-10" />
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            <div className="flex items-center gap-3">
              <Image
                src={IMAGES.logoSquare}
                alt={t("nav.brand")}
                width={44}
                height={44}
                className="size-11 rounded-full object-cover ring-1 ring-brass/30"
              />
              <span className="text-gradient-brass font-heading text-2xl font-bold">
                {t("nav.brand")}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("footer.desc")}
            </p>
          </div>

          {/* Quick links */}
          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-brass">
              {t("footer.quickLinks")}
            </h3>
            <ul className="flex flex-col gap-2">
              {NAV_LINKS.slice(0, 5).map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-brass"
                  >
                    {t(link.key)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Branches */}
          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-brass">
              {t("footer.branchesTitle")}
            </h3>
            <ul className="flex flex-col gap-2">
              {BRANCHES.map((branch) => (
                <li
                  key={branch.id}
                  className="text-sm text-muted-foreground"
                >
                  {t(branch.nameKey)}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-brass">
              {t("footer.contactTitle")}
            </h3>
            <a
              href={EVENT.phoneHref}
              dir="ltr"
              className="w-max text-sm text-muted-foreground transition-colors hover:text-brass"
            >
              {t("contact.phone")}
            </a>
            <span className="text-sm text-muted-foreground">
              {t("contact.location")}
            </span>
            <Link
              href={EVENT.bookHref}
              className="w-max text-sm font-medium text-brass hover:underline"
            >
              {t("nav.book")}
            </Link>
          </div>
        </div>

        <OrnamentDivider className="my-8" />

        <div className="flex flex-col items-center justify-between gap-2 text-center text-xs text-muted-foreground sm:flex-row sm:text-start">
          <p>
            © {year} {t("nav.brand")}. {t("footer.rights")}
          </p>
          <p>{t("footer.made")}</p>
        </div>
      </div>
    </footer>
  );
}
