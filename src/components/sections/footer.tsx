"use client";

import Image from "next/image";
import Link from "next/link";

import { OrnamentDivider } from "@/components/common/ornament-divider";
import { SocialIcon } from "@/components/common/social-icons";
import { useLocale } from "@/i18n/locale-provider";
import { SOCIAL_LINKS } from "@/config/social";
import { EVENT, FOOTER_LINKS, IMAGES } from "@/lib/content";

export function Footer() {
  const { t } = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="relative isolate overflow-hidden pt-16 pb-8 z-0">
      <div className="relative z-10 mx-auto max-w-6xl px-5">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            <div className="flex items-center gap-3">
              <Image
                src={IMAGES.logoCircle}
                alt={t("nav.brand")}
                width={44}
                height={44}
                className="size-11 object-contain"
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
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-primary dark:text-brass">
              {t("footer.quickLinks")}
            </h3>
            <ul className="flex flex-col gap-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-green"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-primary dark:text-brass">
              {t("footer.contactTitle")}
            </h3>
            <a
              href={EVENT.phoneHref}
              dir="ltr"
              className="w-max text-sm text-muted-foreground transition-colors hover:text-green"
            >
              {t("contact.phone")}
            </a>
            <span className="text-sm text-muted-foreground">
              {t("contact.location")}
            </span>
            <Link
              href={EVENT.bookHref}
              className="w-max text-sm font-semibold text-primary hover:underline dark:text-brass"
            >
              {t("nav.book")}
            </Link>
            <div className="mt-2 flex flex-col gap-3">
              <span className="text-xs font-medium text-muted-foreground">{t("contact.socialTitle")}</span>
              <div className="flex items-center gap-2">
                {SOCIAL_LINKS.map((social) => {
                  return (
                    <a
                      key={social.platform}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t(social.ariaLabelKey)}
                      className="glass inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-xl text-foreground transition-colors hover:text-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <SocialIcon platform={social.platform} className="size-5" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <OrnamentDivider className="my-8" />

        <div className="flex flex-col items-center justify-between gap-3 text-center text-xs text-muted-foreground sm:flex-row sm:text-start">
          <p>
            © {year} {t("nav.brand")}. {t("footer.rights")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
            <Link
              href="/terms"
              className="transition-colors hover:text-brass"
            >
              {t("terms.title")}
            </Link>
            <span className="text-border">•</span>
            <Link
              href="/privacy"
              className="transition-colors hover:text-brass"
            >
              {t("privacy.title")}
            </Link>
          </div>
          <p>{t("footer.made")}</p>
        </div>
      </div>
    </footer>
  );
}
