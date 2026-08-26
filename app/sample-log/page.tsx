"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  CloudSun,
  FileDown,
  HardHat,
  MapPin,
  Users,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type Lang = "en" | "el"

const copy = {
  en: {
    badge: "Sample daily log",
    title: "What a signed log looks like",
    sub: "A filled record, exactly as it reaches the file. All data below is example data.",
    docHeader: "DAILY WORK LOG",
    site: "Site",
    date: "Date",
    weather: "Weather",
    temp: "Temp",
    status: "Completed",
    workTitle: "Work performed",
    workBody:
      "Concrete pouring for the ground-floor slab of Block A. Reinforcement installed and checked by the site supervisor before the pour. Formwork removed from the stairwell walls. Ready-mix deliveries: 3 trucks (C25/30).",
    crewTitle: "Crew on site",
    crew: [
      { role: "Concrete workers", count: 4 },
      { role: "Reinforcement fitters", count: 2 },
      { role: "Crane operator", count: 1 },
    ],
    equipTitle: "Equipment",
    equip: "Tower crane — 7 h · Concrete pump — 3 h · Vibrators — 4 units",
    matTitle: "Materials",
    mats: [
      { name: "Ready-mix concrete C25/30", qty: "22 m³" },
      { name: "Rebar B500C, Ø12", qty: "1.4 t" },
      { name: "Formwork panels", qty: "18 pcs" },
    ],
    sigTitle: "Signatures",
    sigContractorLabel: "Contractor",
    sigOwnerLabel: "Owner",
    sigNote: "Both parties sign before the log is locked. After completion, the record cannot be edited or removed.",
    ctaTitle: "This takes about two minutes on site.",
    ctaSub: "Start your first log free — no credit card.",
    cta: "Start free",
    back: "Back to homepage",
    mock: "Example data — not a real site",
  },
  el: {
    badge: "Δείγμα ημερήσιου δελτίου",
    title: "Πώς μοιάζει ένα υπογεγραμμένο δελτίο",
    sub: "Ένα συμπληρωμένο δελτίο, όπως ακριβώς φτάνει στο αρχείο. Όλα τα στοιχεία παρακάτω είναι παραδείγματα.",
    docHeader: "ΗΜΕΡΗΣΙΟ ΔΕΛΤΙΟ ΕΡΓΑΣΙΑΣ",
    site: "Έργο",
    date: "Ημερομηνία",
    weather: "Καιρός",
    temp: "Θερμοκρασία",
    status: "Ολοκληρωμένο",
    workTitle: "Εργασίες που εκτελέστηκαν",
    workBody:
      "Σκυροδέτηση πλάκας ισογείου του Block A. Τοποθέτηση και έλεγχος οπλισμού από τον επιβλέποντα πριν τη σκυροδέτηση. Αφαίρεση ξυλοτύπων από τοίχους κλιμακοστασίου. Παραδόσεις έτοιμου σκυροδέματος: 3 φορτηγά (C25/30).",
    crewTitle: "Συνεργείο στο έργο",
    crew: [
      { role: "Σκυροδετιστές", count: 4 },
      { role: "Σιδεράδες", count: 2 },
      { role: "Χειριστής γερανού", count: 1 },
    ],
    equipTitle: "Εξοπλισμός",
    equip: "Πυργογερανός — 7 ώρες · Αντλία σκυροδέματος — 3 ώρες · Δονητές — 4 τεμ.",
    matTitle: "Υλικά",
    mats: [
      { name: "Έτοιμο σκυρόδεμα C25/30", qty: "22 m³" },
      { name: "Σίδηρος B500C, Ø12", qty: "1,4 t" },
      { name: "Ξυλότυποι", qty: "18 τεμ." },
    ],
    sigTitle: "Υπογραφές",
    sigContractorLabel: "Εργολάβος",
    sigOwnerLabel: "Ιδιοκτήτης",
    sigNote: "Και τα δύο μέρη υπογράφουν πριν κλειδώσει το δελτίο. Μετά την ολοκλήρωση, το αρχείο δεν μπορεί να τροποποιηθεί ή να διαγραφεί.",
    ctaTitle: "Αυτό παίρνει περίπου δύο λεπτά στο εργοτάξιο.",
    ctaSub: "Ξεκινήστε το πρώτο σας δελτίο δωρεάν — χωρίς πιστωτική κάρτα.",
    cta: "Δωρεάν εκκίνηση",
    back: "Επιστροφή στην αρχική",
    mock: "Παραδειγματικά στοιχεία — όχι πραγματικό έργο",
  },
} as const

const LANG_KEY = "sitely-lang"

export default function SampleLogPage() {
  const [lang, setLang] = useState<Lang>("en")

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("lang")
    const saved = window.localStorage.getItem(LANG_KEY)
    const initial: Lang =
      fromUrl === "el" || fromUrl === "en"
        ? fromUrl
        : saved === "el" || saved === "en"
          ? saved
          : "en"
    setLang(initial)
    document.documentElement.lang = initial
  }, [])

  const t = copy[lang]
  const chooseLang = (next: Lang) => {
    setLang(next)
    window.localStorage.setItem(LANG_KEY, next)
    document.documentElement.lang = next
  }

  return (
    <div className="scroll-smooth bg-background text-foreground">
      <div className="hazard-stripe h-1.5" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="container flex items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2" aria-label="Sitely">
            <Image
              src="/sitely-logo.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-md"
            />
            <span className="hidden font-display text-sm font-semibold uppercase tracking-wider sm:inline">
              Sitely
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <div
              className="flex items-center rounded-md border bg-card p-0.5"
              role="group"
              aria-label="Language"
            >
              {(["en", "el"] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => chooseLang(code)}
                  className={`rounded-sm px-2.5 py-1 text-xs font-semibold uppercase transition-colors ${
                    lang === code
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={lang === code}
                >
                  {code === "en" ? "EN" : "ΕΛ"}
                </button>
              ))}
            </div>
            <Button size="sm" asChild>
              <Link href="/signup">
                {t.cta}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="container px-4 py-12 md:py-16">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t.back}
          </Link>

          <div className="mt-6 max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-foreground">
              <FileDown className="h-3.5 w-3.5" aria-hidden />
              {t.badge}
            </p>
            <h1 className="mt-5 font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl">
              {t.title}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">{t.sub}</p>
            <p className="mt-2 inline-block rounded-sm border border-dashed border-border px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t.mock}
            </p>
          </div>

          {/* The document */}
          <div className="mt-10 max-w-3xl rounded-md border bg-card shadow-sm">
            {/* Document header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-6 py-4">
              <p className="font-display text-sm font-bold uppercase tracking-widest">
                {t.docHeader}
              </p>
              <span className="status-badge status-completed">{t.status}</span>
            </div>

            {/* Site meta chips */}
            <div className="grid gap-3 px-6 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: MapPin, label: t.site, value: "Athens North — Block A" },
                { icon: FileDown, label: t.date, value: "2026-08-26" },
                { icon: CloudSun, label: t.weather, value: "Clear" },
                { icon: CloudSun, label: t.temp, value: "23°C" },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-md border bg-muted/50 p-3"
                >
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {/* Photo slot */}
            <div className="px-6 pt-6">
              <div className="flex h-44 items-center justify-center rounded-md border border-dashed border-primary/50 bg-primary/5">
                <div className="text-center">
                  <HardHat className="mx-auto h-8 w-8 text-primary" aria-hidden />
                  <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Photo attached — 3 images
                  </p>
                </div>
              </div>
            </div>

            {/* Work performed */}
            <div className="px-6 pt-6">
              <h2 className="font-display text-sm font-bold uppercase tracking-widest">
                {t.workTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t.workBody}
              </p>
            </div>

            {/* Crew + equipment */}
            <div className="grid gap-6 px-6 pt-6 sm:grid-cols-2">
              <div>
                <h2 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-widest">
                  <Users className="h-4 w-4 text-primary" aria-hidden />
                  {t.crewTitle}
                </h2>
                <ul className="mt-3 space-y-1.5">
                  {t.crew.map((c) => (
                    <li
                      key={c.role}
                      className="flex items-center justify-between rounded-sm border bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span>{c.role}</span>
                      <span className="font-semibold">{c.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-widest">
                  <Wrench className="h-4 w-4 text-primary" aria-hidden />
                  {t.equipTitle}
                </h2>
                <p className="mt-3 rounded-sm border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {t.equip}
                </p>
              </div>
            </div>

            {/* Materials */}
            <div className="px-6 pt-6">
              <h2 className="font-display text-sm font-bold uppercase tracking-widest">
                {t.matTitle}
              </h2>
              <ul className="mt-3 space-y-1.5">
                {t.mats.map((m) => (
                  <li
                    key={m.name}
                    className="flex items-center justify-between rounded-sm border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span>{m.name}</span>
                    <span className="font-semibold">{m.qty}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Signatures */}
            <div className="mt-6 border-t border-border bg-muted/30 px-6 py-6">
              <h2 className="font-display text-sm font-bold uppercase tracking-widest">
                {t.sigTitle}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border bg-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.sigContractorLabel}
                  </p>
                  <div className="mt-3 flex h-12 items-center justify-center rounded-sm border border-dashed border-primary/40 font-display text-2xl italic">
                    G. Papadopoulos
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    26 Aug 2026 · 18:42
                  </p>
                </div>
                <div className="rounded-md border bg-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.sigOwnerLabel}
                  </p>
                  <div className="mt-3 flex h-12 items-center justify-center rounded-sm border border-dashed border-primary/40 font-display text-2xl italic">
                    M. Stathis
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    26 Aug 2026 · 19:05
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {t.sigNote}
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 flex flex-col items-start gap-4 rounded-md border bg-muted/40 p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                {t.ctaTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.ctaSub}</p>
            </div>
            <Button size="lg" asChild>
              <Link href="/signup">
                {t.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-muted/40">
        <div className="container px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Sitely — Construction Log</p>
        </div>
      </footer>
    </div>
  )
}
