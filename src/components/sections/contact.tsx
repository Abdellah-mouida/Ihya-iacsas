"use client";

import { motion } from "framer-motion";
import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { OrnamentDivider } from "@/components/common/ornament-divider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/i18n/locale-provider";
import { EVENT } from "@/lib/content";
import { fadeUp, slideIn, staggerContainer, viewportOnce } from "@/lib/motion";

type Errors = { name?: string; email?: string; message?: string };

export function Contact() {
  const { t, dir } = useLocale();
  const [values, setValues] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");

  function validate(): boolean {
    const next: Errors = {};
    if (!values.name.trim()) next.name = t("contact.errName");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
      next.email = t("contact.errEmail");
    if (!values.message.trim()) next.message = t("contact.errMessage");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    setStatus("sending");
    // Frontend-only: simulate a request.
    window.setTimeout(() => {
      setStatus("success");
      toast.success(t("contact.success"), { description: t("contact.successDesc") });
      setValues({ name: "", email: "", message: "" });
    }, 1100);
  }

  const info = [
    { icon: Phone, label: t("contact.phoneLabel"), value: t("contact.phone"), href: EVENT.phoneHref, ltr: true },
    { icon: Clock, label: t("contact.hoursLabel"), value: t("contact.hours") },
    { icon: MapPin, label: t("contact.locationLabel"), value: t("contact.location") },
  ];

  return (
    <section id="contact" className="relative overflow-hidden py-24 sm:py-32">
      <div className="bg-spirit-gradient absolute inset-x-0 bottom-0 -z-10 h-72 opacity-[0.06] blur-3xl" />
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Form */}
          <motion.form
            noValidate
            onSubmit={handleSubmit}
            variants={staggerContainer(0.1)}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="flex flex-col gap-5"
          >
            <motion.div variants={fadeUp} className="flex flex-col gap-3">
              <span className="inline-flex w-max items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brass">
                <span className="size-1.5 rounded-full bg-brass" />
                {t("contact.kicker")}
              </span>
              <h2 className="font-heading text-3xl font-semibold sm:text-4xl">
                {t("contact.title")}
              </h2>
              <p className="text-muted-foreground">{t("contact.desc")}</p>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-col gap-2">
              <Label htmlFor="name">{t("contact.name")}</Label>
              <Input
                id="name"
                value={values.name}
                aria-invalid={!!errors.name}
                placeholder={t("contact.namePh")}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                className="h-11"
              />
              {errors.name ? (
                <span className="text-xs text-destructive">{errors.name}</span>
              ) : null}
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-col gap-2">
              <Label htmlFor="email">{t("contact.email")}</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                value={values.email}
                aria-invalid={!!errors.email}
                placeholder={t("contact.emailPh")}
                onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                className="h-11"
              />
              {errors.email ? (
                <span className="text-xs text-destructive">{errors.email}</span>
              ) : null}
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-col gap-2">
              <Label htmlFor="message">{t("contact.message")}</Label>
              <Textarea
                id="message"
                rows={5}
                value={values.message}
                aria-invalid={!!errors.message}
                placeholder={t("contact.messagePh")}
                onChange={(e) =>
                  setValues((v) => ({ ...v, message: e.target.value }))
                }
              />
              {errors.message ? (
                <span className="text-xs text-destructive">{errors.message}</span>
              ) : null}
            </motion.div>

            <motion.div variants={fadeUp}>
              <Button
                type="submit"
                disabled={status === "sending"}
                className="bg-brass-gradient h-12 w-full rounded-full text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95 sm:w-auto sm:px-8"
              >
                <Send className="size-5" />
                {status === "sending"
                  ? t("contact.sending")
                  : status === "success"
                    ? t("contact.success")
                    : t("contact.send")}
              </Button>
            </motion.div>
          </motion.form>

          {/* Info panel */}
          <motion.div
            variants={slideIn(dir === "rtl" ? -1 : 1)}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            className="glass-strong relative flex flex-col gap-6 overflow-hidden rounded-3xl p-8 shadow-layered"
          >
            <div className="bg-brass-gradient absolute -right-12 -top-12 size-40 rounded-full opacity-20 blur-3xl" />
            <div>
              <h3 className="font-heading text-2xl font-semibold">
                {t("contact.infoTitle")}
              </h3>
              <OrnamentDivider compact className="mt-3 justify-start" />
            </div>

            <ul className="flex flex-col gap-5">
              {info.map((row) => (
                <li key={row.label} className="flex items-center gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-gold/25 to-emerald/20 text-brass ring-1 ring-brass/25">
                    <row.icon className="size-5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {row.label}
                    </span>
                    {row.href ? (
                      <a
                        href={row.href}
                        dir={row.ltr ? "ltr" : undefined}
                        className="font-medium transition-colors hover:text-brass"
                      >
                        {row.value}
                      </a>
                    ) : (
                      <span className="font-medium">{row.value}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-auto flex items-center gap-3 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
              <Mail className="size-5 shrink-0 text-brass" />
              {t("footer.demo")}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
