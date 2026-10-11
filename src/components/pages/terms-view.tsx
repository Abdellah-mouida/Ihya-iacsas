"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, Phone, ShieldCheck } from "lucide-react";

import { useLocale } from "@/i18n/locale-provider";
import { OrnamentDivider } from "@/components/common/ornament-divider";
import { FacebookIcon, InstagramIcon } from "@/components/common/social-icons";
import { EVENT, IMAGES } from "@/lib/content";
import { TERMS_VERSION } from "@/lib/terms";

interface LegalSection {
  id: string;
  titleKey: string;
  bodyKey: string;
}

const TERMS_SECTIONS: LegalSection[] = [
  { id: "acceptance", titleKey: "terms.secAcceptanceTitle", bodyKey: "terms.secAcceptanceBody" },
  { id: "eligibility", titleKey: "terms.secEligibilityTitle", bodyKey: "terms.secEligibilityBody" },
  { id: "accounts", titleKey: "terms.secAccountsTitle", bodyKey: "terms.secAccountsBody" },
  { id: "acceptable-use", titleKey: "terms.secAcceptableUseTitle", bodyKey: "terms.secAcceptableUseBody" },
  { id: "registration", titleKey: "terms.secRegistrationTitle", bodyKey: "terms.secRegistrationBody" },
  { id: "user-content", titleKey: "terms.secUserContentTitle", bodyKey: "terms.secUserContentBody" },
  { id: "intellectual-property", titleKey: "terms.secIpTitle", bodyKey: "terms.secIpBody" },
  { id: "disclaimers", titleKey: "terms.secDisclaimersTitle", bodyKey: "terms.secDisclaimersBody" },
  { id: "suspension", titleKey: "terms.secSuspensionTitle", bodyKey: "terms.secSuspensionBody" },
  { id: "changes", titleKey: "terms.secChangesTitle", bodyKey: "terms.secChangesBody" },
  { id: "governing-law", titleKey: "terms.secLawTitle", bodyKey: "terms.secLawBody" },
  { id: "contact", titleKey: "terms.secContactTitle", bodyKey: "terms.secContactBody" },
];

export function TermsView() {
  const { t, locale } = useLocale();
  const isRtl = locale === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="relative py-12 sm:py-16 md:py-20" data-testid="terms-page">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Navigation & Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <BackIcon className="size-4" />
            <span>{t("terms.backHome")}</span>
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-brass/30 bg-brass/10 px-3.5 py-1 text-xs font-semibold text-brass">
            <ShieldCheck className="size-3.5" />
            <span>{t("terms.lastUpdated").replace("{version}", TERMS_VERSION)}</span>
          </div>
        </div>

        <div className="mb-10 text-center sm:text-start">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <Image
              src={IMAGES.logoCircle}
              alt="Ihyaa"
              width={36}
              height={36}
              className="size-9 object-contain"
            />
            <span className="font-heading text-sm font-bold tracking-wider text-brass uppercase">
              {t("nav.brand")}
            </span>
          </div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {t("terms.title")}
          </h1>
          <p className="mt-3 max-w-3xl text-base text-muted-foreground sm:text-lg">
            {t("terms.subtitle")}
          </p>
        </div>

        <OrnamentDivider className="mb-10" />

        {/* Content with responsive sticky TOC on desktop */}
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Table of contents sidebar */}
          <aside className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-28 rounded-2xl border border-border/80 bg-card/60 p-6 backdrop-blur-xl shadow-lg">
              <div className="mb-4 flex items-center gap-2 text-brass">
                <FileText className="size-4" />
                <h2 className="font-heading text-sm font-bold uppercase tracking-wider">
                  {t("terms.toc")}
                </h2>
              </div>
              <nav className="flex flex-col gap-1.5">
                {TERMS_SECTIONS.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="truncate rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    {t(sec.titleKey)}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main sections card */}
          <main className="lg:col-span-8">
            <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/75 p-6 backdrop-blur-xl shadow-xl sm:p-10">
              <div className="pattern-islamic pointer-events-none absolute inset-0 opacity-[0.03]" />

              <div className="relative space-y-10">
                {TERMS_SECTIONS.map((sec, idx) => (
                  <section
                    key={sec.id}
                    id={sec.id}
                    className="scroll-mt-28 space-y-3"
                    data-testid={`terms-section-${sec.id}`}
                  >
                    <h2 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                      {t(sec.titleKey)}
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {t(sec.bodyKey)}
                    </p>

                    {/* Contact block under section 12 */}
                    {sec.id === "contact" && (
                      <div className="mt-4 flex flex-wrap items-center gap-4 pt-2">
                        <a
                          href={EVENT.phoneHref}
                          dir="ltr"
                          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/80 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-brass/50 hover:text-brass"
                        >
                          <Phone className="size-4 text-brass" />
                          <span>{t("contact.phone")}</span>
                        </a>
                        <a
                          href="https://www.facebook.com/profile.php?id=61580907187601"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/80 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-brass/50 hover:text-brass"
                        >
                          <FacebookIcon className="size-4 text-brass" />
                          <span>Facebook</span>
                        </a>
                        <a
                          href="https://www.instagram.com/i7yae_shabab/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/80 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-brass/50 hover:text-brass"
                        >
                          <InstagramIcon className="size-4 text-brass" />
                          <span>Instagram</span>
                        </a>
                      </div>
                    )}

                    {idx < TERMS_SECTIONS.length - 1 && (
                      <div className="pt-6 border-b border-border/40" />
                    )}
                  </section>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
