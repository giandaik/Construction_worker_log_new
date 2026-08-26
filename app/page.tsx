"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Camera,
  ClipboardCheck,
  CloudSun,
  Database,
  FileDown,
  HardHat,
  Languages,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  Signature,
  Smartphone,
  Timer,
  Users,
  WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/apiClient"

type Lang = "en" | "el"

const copy = {
  en: {
    brand: "Sitely — Construction Log",
    nav: { features: "Features", how: "How it works", roles: "Roles", trust: "Trust" },
    signIn: "Sign in",
    getStarted: "Get started",
    openDashboard: "Open dashboard",
    heroBadge: "Built for sites with patchy signal",
    heroTitle: "Daily site logs, signed and on file.",
    heroSub:
      "Sitely turns end-of-shift reporting into a two-minute job. Photos, weather, crews and materials — captured at the site, synced to the office, even without signal.",
    heroCta: "Start free",
    heroSecondary: "See how it works",
    sampleLog: "View a sample log",
    trust: ["Works offline", "Signed approvals", "PDF reports"],
    productBadge: "The two-minute end-of-shift log",
    productTitle: "One screen. The whole shift.",
    productSub:
      "Photos, weather, crew, materials and the work done — captured at the site in a single record, ready to sign.",
    featuresTitle: "Everything the end of shift needs",
    featuresSub: "One record per day. Complete, verifiable, on file.",
    f1t: "Offline-first",
    f1d:
      "Log from the trench, not the trailer. Worklogs and photos queue on the device and sync automatically when signal returns.",
    f2t: "Photo proof",
    f2d:
      "Site photos resized on-device and stored securely — every claim backed by a picture.",
    f3t: "Signed approvals",
    f3d:
      "Workers submit, supervisors sign. Statuses — pending, signed, complete — visible at a glance.",
    f4t: "Site context",
    f4d:
      "Weather, temperature and geolocation on every log. The record tells the full story.",
    f5t: "Structured crews & materials",
    f5d:
      "Personnel by role, equipment by the hour, materials with quantities — no free-text chaos.",
    f6t: "PDF reports",
    f6d:
      "Daily logs export to clean PDFs — for the file, the owner, or the client.",
    f7t: "Email notifications",
    f7d:
      "The office gets an email the moment a log is signed, rejected, or completed — final reports land in the inbox with the PDF attached.",
    howTitle: "From site to signed in three steps",
    s1t: "Log it at the site",
    s1d:
      "Two minutes at the end of shift: what was done, who was there, photos, weather.",
    s1img: "/screenshots/13-new-log.jpg",
    s2t: "It syncs itself",
    s2d:
      "No signal? No problem. Logs queue offline and sync the moment you're back online.",
    s2img: "/screenshots/10-dashboard.jpg",
    s3t: "Signed and filed",
    s3d:
      "The supervisor reviews and signs. The report is on file — exportable, traceable.",
    s3img: "/screenshots/14-signatures.jpg",
    rolesTitle: "Built for every hand on site",
    r1t: "Worker",
    r1d:
      "Big buttons, bright screens that stay readable in direct sunlight, and offline capture that never blocks the end of shift.",
    r2t: "Site supervisor",
    r2d:
      "One dashboard: what needs action first, who has signed, which site is falling behind.",
    r3t: "Admin / office",
    r3d:
      "Projects, users, drawings and the full history — one source of truth for the office.",
    offlineTitle: "Dead zones are where the job gets done.",
    offlineBody:
      "Basements, trenches, unfinished high-rises — the places you work rarely have signal. Sitely was built for them: logs and photos queue on-device and sync automatically when you're back online. Nothing is lost, nothing gets rewritten from memory in the office.",
    offlineList: [
      "Pending logs survive shutdowns",
      "Photos queue with the log",
      "Auto-sync on reconnect",
    ],
    trustBadge: "Records you can stand behind",
    trustTitle: "Built for the record, not just the shift",
    trustSub:
      "A signed site log is a legal record. Here is what we do to keep yours trustworthy.",
    trust1t: "Signed, then locked",
    trust1d:
      "A completed log with both signatures is locked — nothing can be edited or removed after the fact. The signature trail stays attached to the record.",
    trust2t: "Your data stays yours",
    trust2d:
      "Every record can be exported or deleted on request. Your site data is never sold and never shared with third parties.",
    trust3t: "Protected in transit and at rest",
    trust3d:
      "Passwords are hashed with bcrypt and access is role-based — workers, supervisors and the office each see only what their role allows.",
    trust4t: "Built to survive dead zones",
    trust4d:
      "Logs and photos queue on the device and sync when signal returns — records survive even where the network does not.",
    statsTitle: "Built to be used on site",
    stats1v: "~2 min",
    stats1l: "per end-of-shift log",
    stats2v: "3",
    stats2l: "platforms — iOS, Android, web",
    stats3v: "24/7",
    stats3l: "offline capture, auto-sync",
    ctaTitle: "Give your end-of-shift back.",
    ctaSub: "Start free in two minutes. No credit card. Works on any phone.",
    footerTagline: "Daily site records — signed, synced, on file.",
    footerRights: "Sitely — Construction Log.",
  },
  el: {
    brand: "Sitely — Ημερολόγιο Εργοταξίου",
    nav: { features: "Δυνατότητες", how: "Πώς λειτουργεί", roles: "Ρόλοι", trust: "Αξιοπιστία" },
    signIn: "Είσοδος",
    getStarted: "Ξεκινήστε",
    openDashboard: "Άνοιγμα πίνακα",
    heroBadge: "Φτιαγμένο για εργοτάξια χωρίς σήμα",
    heroTitle: "Ημερήσια δελτία εργασιών, υπογεγραμμένα και καταχωρημένα.",
    heroSub:
      "Το Sitely κάνει την αναφορά τέλους βάρδιας δουλειά δύο λεπτών. Φωτογραφίες, καιρός, συνεργεία και υλικά — καταγράφονται στο εργοτάξιο, συγχρονίζονται στο γραφείο, ακόμα και χωρίς σήμα.",
    heroCta: "Δωρεάν εκκίνηση",
    heroSecondary: "Πώς λειτουργεί",
    sampleLog: "Δείτε ένα δείγμα δελτίου",
    trust: ["Χωρίς σύνδεση", "Υπογεγραμμένες εγκρίσεις", "Αναφορές PDF"],
    productBadge: "Το δελτίο τέλους βάρδιας σε δύο λεπτά",
    productTitle: "Μία οθόνη. Όλη η βάρδια.",
    productSub:
      "Φωτογραφίες, καιρός, συνεργείο, υλικά και εργασίες — καταγράφονται επιτόπου σε ένα ενιαίο δελτίο, έτοιμο για υπογραφή.",
    featuresTitle: "Ό,τι χρειάζεται το τέλος της βάρδιας",
    featuresSub: "Ένα δελτίο την ημέρα. Πλήρες, ελέγξιμο, αρχειοθετημένο.",
    f1t: "Λειτουργία χωρίς σύνδεση",
    f1d:
      "Καταγραφή από το εργοτάξιο, όχι από το κοντέινερ. Τα δελτία και οι φωτογραφίες μένουν σε ουρά στη συσκευή και συγχρονίζονται αυτόματα μόλις επιστρέψει το σήμα.",
    f2t: "Φωτογραφική τεκμηρίωση",
    f2d:
      "Φωτογραφίες έργου συμπιεσμένες στη συσκευή και αποθηκευμένες με ασφάλεια — κάθε αναφορά συνοδεύεται από εικόνα.",
    f3t: "Υπογεγραμμένη έγκριση",
    f3d:
      "Οι εργαζόμενοι υποβάλλουν, οι επιβλέποντες υπογράφουν. Καταστάσεις — σε εκκρεμότητα, υπογεγραμμένο, ολοκληρωμένο — με μια ματιά.",
    f4t: "Πλαίσιο εργοταξίου",
    f4d:
      "Καιρός, θερμοκρασία και γεωτοποθεσία σε κάθε δελτίο. Το αρχείο λέει όλη την ιστορία.",
    f5t: "Δομημένα συνεργεία & υλικά",
    f5d:
      "Προσωπικό ανά ειδικότητα, εξοπλισμός ανά ώρα, υλικά με ποσότητες — χωρίς χάος ελεύθερου κειμένου.",
    f6t: "Αναφορές PDF",
    f6d:
      "Τα ημερήσια δελτία εξάγονται σε καθαρά PDF — για το αρχείο, τον ιδιοκτήτη ή τον πελάτη.",
    f7t: "Ειδοποιήσεις email",
    f7d:
      "Το γραφείο λαμβάνει email μόλις ένα δελτίο υπογραφεί, απορριφθεί ή ολοκληρωθεί — με το PDF συνημμένο.",
    howTitle: "Από το εργοτάξιο στην υπογραφή σε τρία βήματα",
    s1t: "Το καταγράφεις στο εργοτάξιο",
    s1d:
      "Δύο λεπτά στο τέλος της βάρδιας: τι έγινε, ποιοι ήταν εκεί, φωτογραφίες, καιρός.",
    s1img: "/screenshots/13-new-log.jpg",
    s2t: "Συγχρονίζεται μόνο του",
    s2d:
      "Χωρίς σήμα; Κανένα πρόβλημα. Τα δελτία περιμένουν σε ουρά και συγχρονίζονται μόλις βρεις δίκτυο.",
    s2img: "/screenshots/10-dashboard.jpg",
    s3t: "Υπογραφή και αρχειοθέτηση",
    s3d:
      "Ο επιβλέπων ελέγχει και υπογράφει. Το δελτίο μένει αρχειοθετημένο — εξαγώγιμο, ιχνηλάσιμο.",
    s3img: "/screenshots/14-signatures.jpg",
    rolesTitle: "Φτιαγμένο για κάθε χέρι στο εργοτάξιο",
    r1t: "Εργαζόμενος",
    r1d:
      "Μεγάλα κουμπιά, φωτεινές οθόνες που διαβάζονται στον ήλιο, και καταγραφή χωρίς σύνδεση που δεν καθυστερεί ποτέ το τέλος της βάρδιας.",
    r2t: "Επιβλέπων έργου",
    r2d:
      "Ένα ταμπλό: τι χρειάζεται ενέργεια πρώτα, τι έχει υπογραφεί, ποιο έργο υστερεί.",
    r3t: "Διαχειριστής / γραφείο",
    r3d:
      "Έργα, χρήστες, σχέδια και πλήρες ιστορικό — μία πηγή αλήθειας για το γραφείο.",
    offlineTitle: "Οι νεκρές ζώνες είναι εκεί που γίνεται η δουλειά.",
    offlineBody:
      "Υπόγεια, τάφροι, ημιτελείς πολυκατοικίες — εκεί που δουλεύεις σπάνια υπάρχει σήμα. Το Sitely φτιάχτηκε γι' αυτά: τα δελτία και οι φωτογραφίες μένουν σε ουρά στη συσκευή και συγχρονίζονται αυτόματα μόλις βρεις δίκτυο. Τίποτα δεν χάνεται, τίποτα δεν ξαναγράφεται από μνήμης στο γραφείο.",
    offlineList: [
      "Τα εκκρεμή δελτία επιβιώνουν ακόμα και με κλείσιμο εφαρμογής",
      "Οι φωτογραφίες συνοδεύουν το δελτίο στην ουρά",
      "Αυτόματος συγχρονισμός μόλις επανέλθει το δίκτυο",
    ],
    trustBadge: "Αρχείο στο οποίο μπορείς να στηριχθείς",
    trustTitle: "Φτιαγμένο για το αρχείο, όχι μόνο για τη βάρδια",
    trustSub:
      "Ένα υπογεγραμμένο δελτίο εργασίας είναι νομικό αρχείο. Να τι κάνουμε για να παραμένει αξιόπιστο.",
    trust1t: "Υπογραφή, μετά κλείδωμα",
    trust1d:
      "Ένα ολοκληρωμένο δελτίο με δύο υπογραφές κλειδώνει — τίποτα δεν μπορεί να αλλάξει ή να διαγραφεί εκ των υστέρων. Η αλυσίδα υπογραφών παραμένει προσαρτημένη στο αρχείο.",
    trust2t: "Τα δεδομένα σου ανήκουν",
    trust2d:
      "Κάθε αρχείο μπορεί να εξαχθεί ή να διαγραφεί κατόπιν αιτήματος. Τα δεδομένα του έργου σου δεν πωλούνται και δεν κοινοποιούνται σε τρίτους.",
    trust3t: "Προστασία σε μεταφορά και αποθήκευση",
    trust3d:
      "Οι κωδικοί κρυπτογραφούνται με bcrypt και η πρόσβαση βασίζεται σε ρόλους — εργαζόμενοι, επιβλέποντες και γραφείο βλέπουν μόνο ό,τι επιτρέπει ο ρόλος τους.",
    trust4t: "Φτιαγμένο για νεκρές ζώνες",
    trust4d:
      "Τα δελτία και οι φωτογραφίες μένουν σε ουρά στη συσκευή και συγχρονίζονται μόλις επιστρέψει το σήμα — τα αρχεία επιβιώνουν ακόμα κι όπου το δίκτυο δεν φτάνει.",
    statsTitle: "Φτιαγμένο για χρήση στο εργοτάξιο",
    stats1v: "~2 λεπτά",
    stats1l: "ανά δελτίο τέλους βάρδιας",
    stats2v: "3",
    stats2l: "πλατφόρμες — iOS, Android, web",
    stats3v: "24/7",
    stats3l: "καταγραφή χωρίς σύνδεση, αυτόματος συγχρονισμός",
    ctaTitle: "Πάρε πίσω το τέλος της βάρδιας σου.",
    ctaSub: "Ξεκινήστε δωρεάν σε δύο λεπτά. Χωρίς πιστωτική κάρτα. Δουλεύει σε κάθε κινητό.",
    footerTagline: "Ημερήσια αρχεία έργου — υπογεγραμμένα, συγχρονισμένα, καταχωρημένα.",
    footerRights: "Sitely — Ημερολόγιο Εργοταξίου.",
  },
} as const

const LANG_KEY = "sitely-lang"

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("en")
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    // ?lang=el|en deep-link wins; otherwise the saved preference.
    const fromUrl = new URLSearchParams(window.location.search).get("lang")
    const saved = window.localStorage.getItem(LANG_KEY)
    const initial: Lang = fromUrl === "el" || fromUrl === "en" ? fromUrl : saved === "el" || saved === "en" ? saved : "en"
    setLang(initial)
    document.documentElement.lang = initial
  }, [])

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((res) => res.ok && setAuthed(true))
      .catch(() => {})
  }, [])

  const t = copy[lang]
  const chooseLang = (next: Lang) => {
    setLang(next)
    window.localStorage.setItem(LANG_KEY, next)
    document.documentElement.lang = next
  }

  const features = [
    { icon: WifiOff, title: t.f1t, desc: t.f1d },
    { icon: Camera, title: t.f2t, desc: t.f2d },
    { icon: ClipboardCheck, title: t.f3t, desc: t.f3d },
    { icon: CloudSun, title: t.f4t, desc: t.f4d },
    { icon: Users, title: t.f5t, desc: t.f5d },
    { icon: FileDown, title: t.f6t, desc: t.f6d },
    { icon: Mail, title: t.f7t, desc: t.f7d, isNew: true },
  ]

  const steps = [
    { n: "01", title: t.s1t, desc: t.s1d, img: t.s1img },
    { n: "02", title: t.s2t, desc: t.s2d, img: t.s2img },
    { n: "03", title: t.s3t, desc: t.s3d, img: t.s3img },
  ]

  const roles = [
    {
      icon: HardHat,
      title: t.r1t,
      desc: t.r1d,
      img: "/screenshots/13-new-log.png",
      imgAlt: "Worker view: the two-minute end-of-shift log",
    },
    {
      icon: ShieldCheck,
      title: t.r2t,
      desc: t.r2d,
      img: "/screenshots/10-dashboard.png",
      imgAlt: "Supervisor view: what needs action, who has signed",
    },
    {
      icon: MapPin,
      title: t.r3t,
      desc: t.r3d,
      img: "/screenshots/11-worklogs.png",
      imgAlt: "Office view: the full worklog history with filters",
    },
  ]

  return (
    <div className="scroll-smooth bg-background text-foreground">
      <div className="hazard-stripe h-1.5" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="container flex items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2" aria-label={t.brand}>
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

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {(
              [
                ["#features", t.nav.features],
                ["#how", t.nav.how],
                ["#roles", t.nav.roles],
                ["#trust", t.nav.trust],
              ] as const
            ).map(([href, label]) => (
              <Button key={href} variant="ghost" size="sm" asChild>
                <a href={href}>{label}</a>
              </Button>
            ))}
          </nav>

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
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/login">{t.signIn}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={authed ? "/app" : "/signup"}>
                {authed ? t.openDashboard : t.getStarted}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero — full-bleed photo, headline over the sky */}
      <main id="main" className="scroll-smooth">
        <section className="relative min-h-[560px] overflow-hidden border-b border-border">
        <Image
          src="/hero-construction.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Readability + brand gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-background/10" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" aria-hidden />
        <div className="blueprint-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        <div className="container relative flex min-h-[560px] items-center px-4 py-24">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-foreground backdrop-blur">
              <WifiOff className="h-3.5 w-3.5" aria-hidden />
              {t.heroBadge}
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold uppercase leading-tight tracking-wide sm:text-5xl">
              {t.heroTitle}
            </h1>
            <p className="mt-5 max-w-lg text-lg font-medium text-foreground">{t.heroSub}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href={authed ? "/app" : "/signup"}>
                  {authed ? t.openDashboard : t.heroCta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#how">{t.heroSecondary}</a>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {t.trust.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/sample-log"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              <FileDown className="h-4 w-4" aria-hidden />
              {t.sampleLog}
            </Link>
          </div>
        </div>
        <div className="hazard-stripe absolute inset-x-0 bottom-0 h-1.5" />
      </section>

      {/* Product showcase — the actual app, in the app's own design language */}
      <section id="product" className="container scroll-mt-24 px-4 py-16 md:py-24">
        <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-16">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-foreground">
              {t.productBadge}
            </p>
            <h2 className="mt-5 font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl">
              {t.productTitle}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t.productSub}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href={authed ? "/app" : "/signup"}>
                  {authed ? t.openDashboard : t.heroCta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Phone mockup */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 rounded-full bg-primary/10 blur-3xl" aria-hidden />
            <div className="relative rounded-[2.2rem] border border-border bg-card p-2.5 shadow-2xl">
              <div className="overflow-hidden rounded-[1.7rem] border border-border bg-background">
                {/* Status bar */}
                <div className="flex items-center justify-between px-5 pt-3 text-[10px] font-semibold text-muted-foreground">
                  <span>09:41</span>
                  <span className="h-4 w-20 rounded-full bg-foreground/10" aria-hidden />
                  <span>100%</span>
                </div>
                {/* App header */}
                <div className="flex items-center justify-between px-5 pt-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Site: Athens N — Block A
                    </p>
                    <p className="font-display text-lg font-bold uppercase leading-tight">
                      New work log
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden />
                    Synced
                  </span>
                </div>
                {/* Photo slot */}
                <div className="mx-5 mt-4 flex h-28 items-center justify-center rounded-lg border border-dashed border-primary/50 bg-primary/5">
                  <Camera className="h-7 w-7 text-primary" aria-hidden />
                </div>
                {/* Description */}
                <div className="space-y-2 px-5 pt-4">
                  <div className="h-2 w-full rounded bg-foreground/10" aria-hidden />
                  <div className="h-2 w-3/4 rounded bg-foreground/10" aria-hidden />
                </div>
                {/* Weather + crew row */}
                <div className="grid grid-cols-3 gap-2 px-5 pt-4">
                  {[
                    { icon: CloudSun, label: "23°" },
                    { icon: Users, label: "4 crew" },
                    { icon: MapPin, label: "Pinned" },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center justify-center gap-1.5 rounded-md border bg-muted/50 py-2 text-[11px] font-medium"
                    >
                      <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                      {label}
                    </div>
                  ))}
                </div>
                {/* CTA */}
                <div className="p-5">
                  <div className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary font-display text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
                    Start log
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </div>
                </div>
              </div>
            </div>
            {/* Floating status card */}
            <div className="absolute -left-10 -bottom-6 hidden rounded-md border bg-card p-3 shadow-lg sm:block">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                End of shift
              </p>
              <p className="mt-1 font-display text-sm font-bold">Log filed · 1 min</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container scroll-mt-24 px-4 py-16 md:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold uppercase tracking-wide">
            {t.featuresTitle}
          </h2>
          <p className="mt-3 text-muted-foreground">{t.featuresSub}</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc, isNew }) => (
            <div
              key={title}
              className="group rounded-md border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                {isNew && (
                  <span className="rounded-sm bg-primary px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                    New
                  </span>
                )}
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold uppercase tracking-wide">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border bg-muted/40">
        <div className="container scroll-mt-24 px-4 py-16 md:py-24">
          <h2 className="max-w-2xl font-display text-3xl font-bold uppercase tracking-wide">
            {t.howTitle}
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.n} className="relative">
                {i < steps.length - 1 && (
                  <ArrowRight
                    className="absolute -right-4 top-6 hidden h-5 w-5 text-muted-foreground/50 md:block"
                    aria-hidden
                  />
                )}
                <div className="flex h-full flex-col rounded-md border bg-card p-6">
                  <p className="font-display text-4xl font-bold text-[hsl(45_90%_35%)]">{step.n}</p>
                  <h3 className="mt-3 font-display text-lg font-semibold uppercase tracking-wide">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                  <div className="mt-4 overflow-hidden rounded-md border border-border/60 bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={step.img}
                      alt={step.title}
                      loading="lazy"
                      className="h-auto w-full object-cover"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="container scroll-mt-24 px-4 py-16 md:py-24">
        <h2 className="max-w-2xl font-display text-3xl font-bold uppercase tracking-wide">
          {t.rolesTitle}
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {roles.map(({ icon: Icon, title, desc, img, imgAlt }) => (
            <div
              key={title}
              className="rounded-md border-t-4 border-t-primary bg-card p-6 shadow-sm"
            >
              <Icon className="h-6 w-6 text-primary" aria-hidden />
              <h3 className="mt-4 font-display text-lg font-semibold uppercase tracking-wide">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              <div className="mt-4 overflow-hidden rounded-md border border-border/60 bg-muted/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={imgAlt}
                  loading="lazy"
                  className="h-auto w-full object-cover"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust — the record is the product */}
      <section id="trust" className="container scroll-mt-24 px-4 py-16 md:py-24">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {t.trustBadge}
          </p>
          <h2 className="mt-5 font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl">
            {t.trustTitle}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t.trustSub}</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Lock, title: t.trust1t, desc: t.trust1d },
            { icon: Database, title: t.trust2t, desc: t.trust2d },
            { icon: ShieldCheck, title: t.trust3t, desc: t.trust3d },
            { icon: WifiOff, title: t.trust4t, desc: t.trust4d },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-md border bg-card p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold uppercase tracking-wide">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Offline highlight */}
      <section className="border-y border-border bg-foreground text-background">
        <div className="blueprint-grid container px-4 py-16 md:py-24">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
                <WifiOff className="h-3.5 w-3.5" aria-hidden />
                Offline-first
              </p>
              <h2 className="mt-5 font-display text-3xl font-bold uppercase tracking-wide">
                {t.offlineTitle}
              </h2>
              <p className="mt-4 leading-relaxed text-background/80">{t.offlineBody}</p>
            </div>
            <ul className="space-y-3">
              {t.offlineList.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-md border border-background/15 bg-background/5 p-4"
                >
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </span>
                  <span className="text-sm font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Stats band — honest numbers */}
      <section
        aria-label={t.statsTitle}
        className="border-b border-border bg-muted/40"
      >
        <div className="container px-4 py-12 md:py-16">
          <h2 className="sr-only">{t.statsTitle}</h2>
          <dl className="grid gap-8 text-center sm:grid-cols-3">
            {[
              { v: t.stats1v, l: t.stats1l, icon: Timer },
              { v: t.stats2v, l: t.stats2l, icon: Smartphone },
              { v: t.stats3v, l: t.stats3l, icon: WifiOff },
            ].map(({ v, l, icon: Icon }) => (
              <div key={l}>
                <Icon
                  className="mx-auto h-5 w-5 text-primary"
                  aria-hidden
                />
                <dd className="mt-3 font-display text-4xl font-bold uppercase tracking-wide">
                  {v}
                </dd>
                <dt className="mt-1 text-sm font-medium text-muted-foreground">
                  {l}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA band */}
      <section className="relative overflow-hidden">
        <div className="hazard-stripe h-2" />
        <div className="container px-4 py-16 text-center md:py-20">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            {t.ctaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">{t.ctaSub}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href={authed ? "/app" : "/signup"}>
                {authed ? t.openDashboard : t.heroCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">{t.signIn}</Link>
            </Button>
          </div>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/40">
        <div className="container flex flex-col items-center gap-4 px-4 py-10 text-center">
          <div className="flex items-center gap-2">
            <Image
              src="/sitely-logo.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded-md"
            />
            <span className="font-display text-sm font-semibold uppercase tracking-wider">
              Sitely
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{t.footerTagline}</p>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              {t.signIn}
            </Link>
            <Link href="/signup" className="text-muted-foreground hover:text-foreground">
              {t.getStarted}
            </Link>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Languages className="h-3.5 w-3.5" aria-hidden />
              EN · ΕΛ
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {t.footerRights}
          </p>
        </div>
      </footer>
    </div>
  )
}
