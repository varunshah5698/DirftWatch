import Link from "next/link";
import {
  ArrowRight,
  Check,
  Fingerprint,
  Gauge,
  GitBranch,
  History,
  Network,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { HeroScene } from "@/components/hero-scene";
import { Reveal } from "@/components/reveal";

export const metadata = {
  title: "Driftwatch · Identity drift detection for autonomous AI agents",
  description:
    "Agents drift. Credentials don't. Driftwatch learns each agent's normal behavior, compares it with the role it was created for, and contains the drift without stopping legitimate work.",
  robots: { index: true, follow: true },
};

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#attack", label: "The attack" },
  { href: "#platform", label: "Platform" },
];

const STATS = [
  { value: "60", label: "Agents under watch" },
  { value: "38s", label: "Median detection" },
  { value: "3.7%", label: "False positive rate" },
  { value: "100%", label: "Manifest coverage" },
];

const TICKER = [
  { tone: "red", text: "hr.salary read outside role" },
  { tone: "orange", text: "supplier-acme-pricing.pdf · untrusted" },
  { tone: "red", text: "egress 45.83.211.19 · denied at gateway" },
  { tone: "lime", text: "baseline learned · 6.2h fresh" },
  { tone: "orange", text: "delegation depth 2 · above manifest" },
  { tone: "lime", text: "manifest v2026.09.3 · applied with grace" },
  { tone: "red", text: "canary touch · payroll_master_decoy.csv" },
  { tone: "lime", text: "supplier.search · allowed · in scope" },
  { tone: "orange", text: "slow-drift CUSUM · +1.00" },
  { tone: "red", text: "replay attempt · blocked · 3/5 min" },
];

const STEPS = [
  {
    n: "01",
    title: "Register the role",
    body: "A versioned YAML manifest declares the tools, data classes, destinations, operating hours and call depth an agent may use. The manifest is the contract everything else is measured against.",
  },
  {
    n: "02",
    title: "Learn the baseline",
    body: "Tool frequency, data distribution, Markov action transitions, egress volume and the delegation graph are learned from a rolling window — with a deliberately wide band for new agents.",
  },
  {
    n: "03",
    title: "Compare continuously",
    body: "Scope, drift, sequence, exfiltration, delegation and injection are scored on every event window. Change-management events open a grace period so approved shifts never page anyone.",
  },
  {
    n: "04",
    title: "Contain with evidence",
    body: "Every alert ships with its taint path, its contributing factors and a reversible, audit-logged response — restrict the exact data class or destination, keep the rest of the work flowing.",
  },
];

const FACTOR_GRID = [
  { label: "Exfiltration signal", points: 31, note: "2 new destinations · max 3.3 MiB" },
  { label: "Injection taint", points: 27, note: "supplier PDF → 6 steps → 5 actions" },
  { label: "Role scope", points: 25, note: "5 violation types · 2 restricted reads" },
  { label: "Distributional drift", points: 10, note: "JS divergence 0.25 max" },
  { label: "Sequence anomaly", points: 5, note: "low-probability transition" },
  { label: "Delegation anomaly", points: 2, note: "depth 2 above manifest" },
];

const QUEUE_ROWS = [
  { score: 100, title: "Prompt injection with outbound data exfiltration", agent: "Procurement Atlas", sev: "CRITICAL", active: true },
  { score: 96, title: "Canary resource touched", agent: "HR Relay", sev: "CRITICAL", active: false },
  { score: 92, title: "Sensitive data routed to an unapproved destination", agent: "Finance Cedar", sev: "HIGH", active: false },
];

const BENTO = [
  {
    icon: Radar,
    title: "Indirect injection taint",
    body: "Follows an untrusted document, web page or peer message to the exact actions it influenced, and shows the causal thread between them.",
    span: "lg:col-span-3",
  },
  {
    icon: ShieldCheck,
    title: "Surgical containment",
    body: "Restrict blocks the exact data class, tool or destination. The agent's valid token keeps working for everything declared in its role.",
    span: "lg:col-span-3",
  },
  {
    icon: GitBranch,
    title: "Agent chains",
    body: "Force-directed delegation graph with blast radius and propagation highlighting.",
    span: "lg:col-span-2",
  },
  {
    icon: Gauge,
    title: "Containment ladder",
    body: "Monitor → Notify → Step-up → Restrict → Quarantine → Isolate, all reversible with one click.",
    span: "lg:col-span-2",
  },
  {
    icon: Waypoints,
    title: "Cold-start priors",
    body: "Role templates give new agents a wide, honest band until real history accumulates.",
    span: "lg:col-span-2",
  },
];

const FOOTER_COLS = [
  { title: "Product", links: ["Overview", "Agent directory", "Simulation lab", "Role manifests"] },
  { title: "Developers", links: ["REST API", "TypeScript SDK", "Python SDK", "Ingestion signing"] },
  { title: "Company", links: ["Security", "Threat model", "Status", "Contact"] },
];

const TONE: Record<string, string> = {
  red: "var(--red)",
  orange: "var(--orange)",
  lime: "var(--lime)",
};

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 40 40" role="img" aria-label="Driftwatch">
        <rect width="40" height="40" rx="13" fill="var(--white)" />
        <circle cx="20" cy="20" r="10.5" fill="none" stroke="var(--bg)" strokeWidth="2" />
        <circle cx="20" cy="20" r="5" fill="none" stroke="var(--bg)" strokeWidth="2" />
        <path d="M27 13 L34 6" stroke="var(--bg)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="20" cy="20" r="2" fill="var(--orange)" />
      </svg>
      {!compact ? (
        <span className="hidden leading-none sm:block">
          <span className="display-tight block text-[16px] tracking-[0.08em]">Driftwatch</span>
          <span className="mt-1 block text-[8px] uppercase tracking-[0.22em] text-[var(--muted-dim)]">
            identity continuity
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** Centered section header used by the full-width bands. */
function CenterHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto max-w-[820px] text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display-tight mx-auto mt-4 max-w-[22ch] text-[clamp(28px,4.2vw,48px)] leading-[1.02]">
        {title}
      </h2>
      {sub ? (
        <p className="mx-auto mt-5 max-w-[62ch] text-[13px] leading-relaxed text-[var(--muted)]">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      {/* ------------------------------------------------------------- nav */}
      <header
        className="sticky top-0 z-40 pb-4 pt-3"
        style={{
          background:
            "linear-gradient(to bottom, var(--bg) 0%, color-mix(in srgb, var(--bg) 82%, transparent) 68%, transparent 100%)",
        }}
      >
        <div className="mx-auto flex h-14 w-[min(1240px,calc(100%_-_1.5rem))] items-center gap-3 rounded-full border border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-4 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:px-5">
          <Link href="/" className="focus-ring shrink-0" aria-label="Driftwatch home">
            <Logo />
          </Link>
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Marketing">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="focus-ring rounded-full px-3 py-2 text-[12.5px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--panel)] hover:text-[var(--text)]"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="focus-ring pill !h-10 !text-[12.5px]">
              Sign in
            </Link>
            <Link href="/signup" className="focus-ring btn btn-primary !h-10 !text-[12.5px]">
              Start free <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        {/* The 3D fleet scene runs edge to edge behind the whole hero. */}
        <HeroScene className="pointer-events-none absolute inset-0 h-full w-full" />
        {/* Scrims keep the centered copy legible over the scene. */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "linear-gradient(to bottom, color-mix(in srgb, var(--bg) 45%, transparent), transparent 26%, transparent 60%, var(--bg) 97%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(820px 520px at 50% 36%, color-mix(in srgb, var(--bg) 74%, transparent), transparent 74%)",
          }}
        />

        <div className="relative mx-auto max-w-[1240px] px-4 pb-28 pt-24 text-center sm:px-6 lg:pb-36 lg:pt-32">
          <Reveal>
            <span className="chip chip-lime mx-auto">
              <span className="live-dot" /> Now monitoring 60 demo agents
            </span>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="display mx-auto mt-7 max-w-[13ch] text-[clamp(46px,9vw,108px)] leading-[0.88]">
              Agents drift.
              <br />
              <span className="text-[var(--lime)]">Credentials</span> don&apos;t.
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="mx-auto mt-6 max-w-[58ch] text-[15px] leading-relaxed text-[var(--text-soft)]">
              A valid token proves who an agent is — not what it has become. Driftwatch learns each
              agent&apos;s normal behavior, compares it with the role it was created for, and
              contains the drift without stopping legitimate work.
            </p>
          </Reveal>
          <Reveal delay={270}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="focus-ring btn btn-primary !h-12 !px-6 !text-[14px]">
                Open the demo console <ArrowRight size={16} aria-hidden />
              </Link>
              <a href="#attack" className="focus-ring btn !h-12 !px-6 !text-[13.5px]">
                See the attack replay
              </a>
            </div>
          </Reveal>
        </div>

        {/* Floating detection card — overlaps into the band below. */}
        <Reveal delay={360} className="relative z-10 mx-auto -mb-14 max-w-[1020px] px-4">
          <div className="panel overflow-hidden backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-5 py-3">
              <span className="chip chip-red">
                <ShieldAlert size={11} aria-hidden /> Critical · 100
              </span>
              <span className="text-[12.5px] font-semibold">
                Prompt injection with outbound data exfiltration
              </span>
              <span className="ml-auto text-[10px] text-[var(--muted-dim)]">
                detected in 38s · confidence 86%
              </span>
            </div>
            <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
              {FACTOR_GRID.map((factor) => (
                <div
                  key={factor.label}
                  className="border-b border-[var(--line)] px-5 py-3.5 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-child(2n):not(:nth-child(3n))]:border-r"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-medium text-[var(--text-soft)]">
                      {factor.label}
                    </span>
                    <span className="metric-sm text-[13px] font-bold text-[var(--lime)]">
                      +{factor.points}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                    <span
                      className="block h-full rounded-full bg-[var(--lime)]"
                      style={{ width: `${factor.points * 3.2}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--muted-dim)]">{factor.note}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 px-5 py-3 text-[11px] text-[var(--muted)]">
              <Check size={13} className="text-[var(--lime)]" aria-hidden />
              Σ contributions = 100 = risk score. Every alert decomposes like this.
            </div>
          </div>
        </Reveal>
      </section>

      {/* ----------------------------------------------------------- stats */}
      <section className="border-b border-[var(--line)] bg-[var(--panel-soft)] pt-24">
        <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <Reveal
              key={stat.label}
              delay={index * 70}
              className={index % 2 !== 0 ? "border-l border-[var(--line)] pl-6" : "lg:border-l lg:border-[var(--line)] lg:pl-6"}
            >
              <p className="metric-sm text-[clamp(30px,3.4vw,44px)] font-bold leading-none">
                {stat.value}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-dim)]">
                {stat.label}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- ticker */}
      <div className="overflow-hidden border-b border-[var(--line)] py-3" aria-hidden>
        <div className="marquee flex w-max items-center gap-9 pl-4">
          {[...TICKER, ...TICKER].map((item, index) => (
            <span
              key={`${item.text}-${index}`}
              className="inline-flex shrink-0 items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--muted)]"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: TONE[item.tone] }}
              />
              {item.text}
            </span>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------- statement */}
      <section className="border-b border-[var(--line)] py-24 lg:py-32">
        <div className="mx-auto max-w-[1240px] px-4 text-center sm:px-6">
          <Reveal>
            <p className="eyebrow">The gap</p>
            <h2 className="display mx-auto mt-6 max-w-[21ch] text-[clamp(32px,5.4vw,64px)] leading-[0.94]">
              Permission checks ask <span className="text-[var(--muted-dim)]">who</span> you are.
              <br className="hidden sm:block" /> We ask{" "}
              <span className="text-[var(--orange)]">what you&apos;ve become</span>.
            </h2>
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-[900px] gap-3 text-left sm:grid-cols-2">
            <Reveal delay={100}>
              <div className="panel h-full p-5">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--red)]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--red-soft)]">
                    <ShieldAlert size={14} aria-hidden />
                  </span>
                  Valid identity, stolen intent
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--muted)]">
                  A hidden instruction in a supplier PDF turns a procurement agent into an HR-data
                  scraper. Its token is still valid, so every access check still passes.
                </p>
              </div>
            </Reveal>
            <Reveal delay={180}>
              <div className="panel h-full p-5">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--orange)]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--orange-soft)]">
                    <History size={14} aria-hidden />
                  </span>
                  No history to compare
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--muted)]">
                  Short-lived agents have no baseline. Role templates and priors keep coverage
                  honest until real events accumulate.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- timeline */}
      <section id="how" className="scroll-mt-24 border-b border-[var(--line)] bg-[var(--panel-soft)] py-20 lg:py-24">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <CenterHead
            eyebrow="How it works"
            title="Four steps from registration to containment."
          />
          <ol className="relative mx-auto mt-14 max-w-[780px]">
            <span
              aria-hidden
              className="absolute left-[19px] top-3 bottom-3 w-px bg-[var(--line)]"
            />
            {STEPS.map((step, index) => (
              <Reveal
                as="li"
                key={step.n}
                delay={index * 60}
                className="relative flex gap-6 pb-11 last:pb-0"
              >
                <span className="metric-sm relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--panel)] text-[13px] font-bold text-[var(--lime)]">
                  {step.n}
                </span>
                <div className="pt-1.5">
                  <h3 className="display-tight text-[16px] uppercase tracking-wide">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[64ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------------------------------------------------- attack */}
      <section id="attack" className="scroll-mt-24 border-b border-[var(--line)] py-20 lg:py-24">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <CenterHead
            eyebrow="The attack · end to end"
            title="A poisoned PDF, caught in 38 seconds."
            sub="This exact scenario ships in the demo console and in the simulation lab. Every number below is produced by the same engine that scores live telemetry."
          />

          <div className="mx-auto mt-12 max-w-[1120px]">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { chip: "chip-orange", label: "Step 1 · the bait", title: "supplier-acme-pricing.pdf", body: "A white-on-white instruction block is buried in the extracted text. The document is marked untrusted at the edge; only its hash and classification are stored." },
                { chip: "chip-red", label: "Step 2 · the drift", title: "Out-of-role access", body: "Within six steps the agent reads hr.salary and hr.performance — classes no procurement manifest declares." },
                { chip: "chip-lime", label: "Step 3 · the response", title: "Restrict, don't stop", body: "Egress to 45.83.211.19 and exfil-relay.top is denied while supplier.search keeps working. The token stays valid." },
              ].map((step, index) => (
                <Reveal key={step.label} delay={index * 70}>
                  <div className="panel h-full p-5">
                    <span className={`chip ${step.chip}`}>{step.label}</span>
                    <h3 className="display-tight mt-4 text-[14px] uppercase tracking-wide">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Browser-window mockup of the triage console */}
            <Reveal delay={220}>
              <div className="panel mt-3 overflow-hidden">
                <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-2.5">
                  <span className="flex gap-1.5" aria-hidden>
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--red)]/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--orange)]/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--lime)]/70" />
                  </span>
                  <span className="mx-auto flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-1 font-mono text-[9.5px] text-[var(--muted-dim)]">
                    app.driftwatch.dev/alerts?alert=alr-2101
                  </span>
                  <span className="chip chip-lime !py-0.5 !text-[9px]">
                    <span className="live-dot" /> live
                  </span>
                </div>
                <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
                  <div className="border-b border-[var(--line)] p-3 lg:border-b-0 lg:border-r">
                    <p className="eyebrow mb-2 px-1">Alert queue</p>
                    <div className="space-y-1.5">
                      {QUEUE_ROWS.map((row) => (
                        <div
                          key={row.title}
                          className={`rounded-xl border px-3 py-2.5 ${
                            row.active
                              ? "border-[var(--line-strong)] bg-[var(--panel-hi)]"
                              : "border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="metric-sm flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[9.5px] font-bold"
                              style={{
                                borderColor: row.score >= 95 ? "var(--red)" : "var(--orange)",
                                color: row.score >= 95 ? "var(--red)" : "var(--orange)",
                                background: row.score >= 95 ? "var(--red-soft)" : "var(--orange-soft)",
                              }}
                            >
                              {row.score}
                            </span>
                            <p className="min-w-0 flex-1 truncate text-[11px] font-medium">
                              {row.title}
                            </p>
                          </div>
                          <p className="mt-1 truncate pl-9 text-[9px] text-[var(--muted-dim)]">
                            {row.agent} · {row.sev}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="chip chip-red">CRITICAL</span>
                      <span className="chip">acknowledged</span>
                      <span className="chip chip-orange">
                        <GitBranch size={10} aria-hidden /> inc-2101
                      </span>
                    </div>
                    <h3 className="display-tight mt-3 text-[18px] uppercase leading-tight">
                      Prompt injection with outbound data exfiltration
                    </h3>
                    <p className="mt-1.5 text-[10.5px] text-[var(--muted-dim)]">
                      Procurement Atlas · 24 Oct, 15:07 UTC · confidence 86%
                    </p>
                    <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                      {FACTOR_GRID.map((factor) => (
                        <div key={factor.label}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-[var(--text-soft)]">
                              {factor.label}
                            </span>
                            <span className="metric-sm text-[11.5px] font-bold text-[var(--lime)]">
                              +{factor.points}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                            <span
                              className="block h-full rounded-full bg-[var(--lime)]"
                              style={{ width: `${factor.points * 3.2}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2 border-t border-[var(--line)] pt-3 text-[10.5px] text-[var(--muted)]">
                      <Check size={12} className="text-[var(--lime)]" aria-hidden />
                      Σ contributions = 100 · verified
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- platform */}
      <section id="platform" className="scroll-mt-24 border-b border-[var(--line)] bg-[var(--panel-soft)] py-20 lg:py-24">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <CenterHead
            eyebrow="The platform"
            title="Built for the questions permission checks cannot answer."
            sub="Six signals feed one explainable score, and every response is graduated and reversible — monitor, notify, restrict, quarantine or isolate without breaking declared work."
          />

          <div className="mx-auto mt-12 grid max-w-[1120px] gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {/* Large card: the alignment dial */}
            <Reveal className="sm:col-span-2 lg:col-span-3 lg:row-span-2">
              <div className="panel flex h-full flex-col items-center p-7 text-center">
                <p className="eyebrow">Role alignment score</p>
                <svg viewBox="0 0 120 120" className="mt-6 h-44 w-44" role="img" aria-label="Role alignment 82 of 100">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" strokeWidth="9" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="var(--lime)"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={`${0.82 * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                    transform="rotate(-90 60 60)"
                  />
                  <text x="60" y="58" textAnchor="middle" fill="var(--text)" fontSize="27" fontWeight="700">
                    82
                  </text>
                  <text x="60" y="74" textAnchor="middle" fill="var(--muted-dim)" fontSize="7" letterSpacing="1.8">
                    OF 100 · 86% CONFIDENCE
                  </text>
                </svg>
                <h3 className="display-tight mt-6 text-[17px] uppercase tracking-wide">
                  One number, fully decomposed
                </h3>
                <p className="mt-2.5 max-w-[46ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
                  Scope, drift, sequence, exfiltration, delegation and injection are combined by a
                  weighted logistic model. Contributions always sum to the total you see — no black
                  box, no unexplained alerts.
                </p>
              </div>
            </Reveal>

            {BENTO.map((item, index) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.title} delay={(index + 1) * 60} className={item.span}>
                  <div className="panel flex h-full flex-col p-6">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--lime-soft)] text-[var(--lime)]">
                      <Icon size={17} aria-hidden />
                    </span>
                    <h3 className="display-tight mt-4 text-[15px] uppercase tracking-wide">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
                      {item.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* Gateway strip */}
          <Reveal delay={140}>
            <div className="panel mx-auto mt-3 flex max-w-[1120px] flex-wrap items-center gap-4 px-6 py-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--orange-soft)] text-[var(--orange)]">
                <Network size={17} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-semibold">Gateway proxy · policy-as-code</h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
                  Every tool call is evaluated at the gateway with dry-run previews, enforcement
                  levels and one-click rollback.
                </p>
              </div>
              <span className="chip">
                <Fingerprint size={11} aria-hidden /> HMAC-signed ingestion
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------- CTA */}
      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(700px 340px at 50% 42%, rgba(201,247,111,0.11), transparent 72%)",
          }}
        />
        <div className="relative mx-auto max-w-[1240px] px-4 py-24 text-center sm:px-6 lg:py-28">
          <h2 className="display mx-auto max-w-[16ch] text-[clamp(32px,5.2vw,60px)] leading-[0.92]">
            Stop trusting the token.
            <br />
            <span className="text-[var(--lime)]">Start watching the behavior.</span>
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="focus-ring btn btn-primary !h-12 !px-6 !text-[14px]">
              Create a free account <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="/login" className="focus-ring btn !h-12 !px-6 !text-[13.5px]">
              I already have one
            </Link>
          </div>
          <p className="mt-5 text-[11px] text-[var(--muted-dim)]">
            No credit card. Every seeded agent, event and alert is synthetic.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- footer */}
      <footer className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <Logo />
            <p className="mt-4 max-w-[34ch] text-[12px] leading-relaxed text-[var(--muted)]">
              Identity drift detection for autonomous AI agents. Learn the role, watch the behavior,
              contain the drift.
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="eyebrow mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <span className="text-[12px] text-[var(--muted)] transition-colors hover:text-[var(--text)]">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-[var(--line)] pt-6 text-[11px] text-[var(--muted-dim)] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Driftwatch. Synthetic demo data throughout.</span>
          <span className="inline-flex items-center gap-4">
            <span>Security</span>
            <span>Privacy</span>
            <span>Status</span>
          </span>
        </div>
      </footer>
    </div>
  );
}