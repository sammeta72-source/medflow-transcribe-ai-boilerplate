"use client";
// MedFlow Transcribe AI — marketing landing page.
// Sections: Hero, trust row, stats bar, features grid, workflow pipeline,
// pricing, roadmap, positioning quote, footer CTA, sticky CTA.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Bot, Check, CheckCircle2, ChevronRight, Clock, FileText,
  LayoutDashboard, Lock, Mic, Plug, Rocket, ShieldCheck, Sparkles,
  Stethoscope, Workflow, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME, APP_TAGLINE, POSITIONING, ROADMAP, SAAS_PLANS } from "@/lib/medflow/constants";
import { usd } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";

const TRUST = ["HIPAA-aligned", "Audit-logged", "MFA enforced", "FHIR R4 ready"];

const STATS = [
  { label: "Faster TAT", value: "50%", sub: "vs manual transcription" },
  { label: "AI draft confidence", value: "92%", sub: "whisper-large-v3" },
  { label: "AI agents", value: "10", sub: "FastAPI orchestration" },
  { label: "EHR integrations", value: "8", sub: "Epic / Cerner / FHIR / HL7" },
];

const FEATURES = [
  { icon: Lock, title: "Secure audio intake", desc: "Encrypted upload with checksum, malware scan, and PHI redaction. Audio is isolated per tenant." },
  { icon: Bot, title: "AI transcription", desc: "Whisper-large-v3 + medical adapters produce a confidence-scored draft with section structuring." },
  { icon: FileText, title: "Structured drafts", desc: "Templates for SOAP, H&P, Op Note, Discharge, Radiology and more — entities extracted as chips." },
  { icon: ShieldCheck, title: "QA risk detection", desc: "QA Agent flags med conflicts, laterality, negation, missing sections — severity-scored." },
  { icon: Clock, title: "SLA monitoring", desc: "Per-job SLA timer with on-track / at-risk / breach states, escalations, and pause-on-clarify." },
  { icon: Plug, title: "EHR delivery", desc: "Deliver via FHIR R4 DocumentReference, HL7 v2 MDM, SFTP, REST webhook, or branded portal." },
];

const PIPELINE = [
  { label: "Intake", color: "mf-tab-yellow" },
  { label: "Validate", color: "mf-tab-yellow" },
  { label: "Transcribe", color: "mf-tab-orange" },
  { label: "Structure", color: "mf-tab-orange" },
  { label: "QA", color: "mf-tab-green" },
  { label: "Route", color: "mf-tab-green" },
  { label: "Edit", color: "mf-tab-brown" },
  { label: "Provider", color: "mf-tab-teal" },
  { label: "Approve", color: "mf-tab-teal" },
  { label: "Deliver", color: "mf-tab-blue" },
];

const ROADMAP_BADGES: Record<string, string> = {
  complete: "bg-emerald-100 text-emerald-800 border-emerald-300",
  "in-progress": "bg-amber-100 text-amber-800 border-amber-300",
  planned: "bg-slate-100 text-slate-700 border-slate-300",
};

export interface LandingProps {
  onEnter: () => void;
}

export function Landing({ onEnter }: LandingProps) {
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 640);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden mf-gradient text-white">
        <div className="absolute inset-0 opacity-25">
          <img src="/hero.png" alt="" aria-hidden className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B5345]/85 via-[#0d6651]/75 to-[#1ABC9C]/45" />

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24 lg:px-8">
          <div className="flex flex-col justify-center gap-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="flex items-center gap-3"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
                <Bot className="h-6 w-6 text-white" strokeWidth={2} />
              </span>
              <div className="flex flex-col">
                <span className="text-base font-bold leading-tight">{APP_NAME}</span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#a8e6df]">
                  Healthcare Documentation Operations Platform
                </span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-6xl"
            >
              {APP_NAME}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="max-w-xl text-base text-white/85 sm:text-lg"
            >
              {APP_TAGLINE}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.18 }}
              className="flex flex-wrap gap-3"
            >
              <Button
                size="lg"
                onClick={onEnter}
                className="bg-white text-[#0B5345] hover:bg-white/90 shadow-lg"
              >
                Enter Platform <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/5 text-white hover:bg-white/15"
                onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              >
                View Plans
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.28 }}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-white/85"
            >
              {TRUST.map((t, i) => (
                <span key={t} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-white/40">·</span>}
                  <ShieldCheck className="h-3.5 w-3.5 text-[#a8e6df]" />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right column — image + floating stat card */}
          <div className="relative hidden lg:block">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="absolute inset-0 rounded-2xl ring-1 ring-white/20"
            >
              <img
                src="/hero.png"
                alt="Medical AI soundwave visualization"
                className="h-full w-full rounded-2xl object-cover opacity-95"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.45 }}
              className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/95 p-4 text-foreground shadow-xl backdrop-blur"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1ABC9C]/15">
                  <Sparkles className="h-5 w-5 text-[#1ABC9C]" />
                </span>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Live agent run · transcription
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    JOB-2024-001 · 92% AI confidence · 0.74s
                  </p>
                </div>
                <Badge className="bg-emerald-500 text-white">succeeded</Badge>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="bg-card p-6 text-center"
            >
              <p className="text-3xl font-extrabold text-primary sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{s.label}</p>
              <p className="text-[11px] text-muted-foreground">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <Badge variant="outline" className="mb-3 border-secondary/40 text-secondary">
            <Sparkles className="mr-1 h-3 w-3" /> Platform capabilities
          </Badge>
          <h2 className="text-3xl font-bold sm:text-4xl">A complete transcription operations stack</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            From secure intake to FHIR delivery — every step is automated, audit-logged, and human-reviewable.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardHeader className="pb-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <CardTitle className="mt-3 text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Workflow pipeline ───────────────────────────────── */}
      <section className="bg-[#17202A] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <Badge variant="outline" className="mb-3 border-white/20 text-white/80">
              <Workflow className="mr-1 h-3 w-3" /> 10-step pipeline
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">From dictation to delivery</h2>
            <p className="mx-auto mt-3 max-w-2xl text-white/70">
              Each step is powered by a tenant-aware AI agent, with human escalation routes at QA, Provider, and Delivery.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-1">
            {PIPELINE.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className="flex items-center gap-2"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={cn("relative grid h-12 w-12 place-items-center rounded-full text-sm font-bold text-white shadow-md", step.color)}>
                    {i + 1}
                  </div>
                  <span className="text-[11px] font-medium text-white/80">{step.label}</span>
                </div>
                {i < PIPELINE.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-white/40" />
                )}
              </motion.div>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-3xl rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-[#1ABC9C]" />
              <p className="text-sm text-white/80">
                <span className="font-semibold text-white">Human-in-the-loop by design.</span>{" "}
                AI never marks a document clinically final. Every job passes through a Medical Editor, a QA Analyst, and the originating Provider before delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Positioning quote ───────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="border-l-4 border-secondary bg-card p-6 shadow-sm sm:p-8">
          <Stethoscope className="h-7 w-7 text-secondary" />
          <p className="mt-3 text-xl font-medium leading-relaxed text-foreground sm:text-2xl">
            {POSITIONING}
          </p>
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            — MedFlow Transcribe AI positioning statement
          </p>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className="bg-gradient-to-b from-background to-muted/40 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <Badge variant="outline" className="mb-3 border-secondary/40 text-secondary">
              <Zap className="mr-1 h-3 w-3" /> SaaS pricing
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">Plans that scale with your volume</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Per-tenant subscription with metered audio minutes. Trial includes the full Professional feature set.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {SAAS_PLANS.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <Card
                  className={cn(
                    "relative h-full",
                    p.highlight && "ring-2 ring-secondary shadow-xl",
                  )}
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                      Most popular
                    </span>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      {p.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{p.target}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex items-end gap-1">
                      {p.pricePerMonth === 0 ? (
                        <span className="text-3xl font-extrabold">Custom</span>
                      ) : (
                        <>
                          <span className="text-4xl font-extrabold">{usd(p.pricePerMonth)}</span>
                          <span className="mb-1 text-sm text-muted-foreground">/ mo</span>
                        </>
                      )}
                    </div>
                    <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-md bg-muted p-2">
                        <p className="font-bold text-foreground">
                          {p.audioMinutes === -1 ? "Unlimited" : `${p.audioMinutes}`}
                        </p>
                        <p className="text-muted-foreground">audio min</p>
                      </div>
                      <div className="rounded-md bg-muted p-2">
                        <p className="font-bold text-foreground">
                          {p.seats === -1 ? "Unlimited" : p.seats}
                        </p>
                        <p className="text-muted-foreground">seats</p>
                      </div>
                      <div className="rounded-md bg-muted p-2">
                        <p className="font-bold text-foreground">
                          {p.storageGb === -1 ? "Unlimited" : `${p.storageGb}GB`}
                        </p>
                        <p className="text-muted-foreground">storage</p>
                      </div>
                    </div>
                    <ul className="mb-5 space-y-2 text-sm">
                      {p.features.map(f => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                          <span className="text-foreground/80">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={p.highlight ? "default" : "outline"}
                      onClick={onEnter}
                    >
                      {p.pricePerMonth === 0 ? "Contact sales" : "Start trial"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roadmap ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <Badge variant="outline" className="mb-3 border-secondary/40 text-secondary">
            <Rocket className="mr-1 h-3 w-3" /> Product roadmap
          </Badge>
          <h2 className="text-3xl font-bold sm:text-4xl">Where we are, where we&apos;re going</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {ROADMAP.map((phase, i) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg">{phase.phase}</CardTitle>
                  <Badge className={cn("border", ROADMAP_BADGES[phase.status])}>
                    {phase.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-sm">
                    {phase.items.map(item => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                        <span className="text-foreground/80">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────────── */}
      <section className="mf-gradient text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 lg:px-8">
          <LayoutDashboard className="h-10 w-10 text-white/90" />
          <h2 className="text-3xl font-bold sm:text-4xl">
            Ready to modernize your transcription operations?
          </h2>
          <p className="max-w-2xl text-white/85">
            Enter the demo tenant, drag jobs across the kanban board, run AI agents on real seeded dictations, and inspect FHIR / HL7 delivery — all in real time.
          </p>
          <Button
            size="lg"
            onClick={onEnter}
            className="bg-white text-[#0B5345] shadow-lg hover:bg-white/90"
          >
            Enter Platform <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="bg-[#17202A] px-4 py-6 text-[11px] text-white/70 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#1ABC9C]" />
            <span className="font-semibold text-white">{APP_NAME}</span>
            <span className="text-white/40">·</span>
            <span>Secure AI-assisted medical transcription operations</span>
          </div>
          <div className="flex items-center gap-3">
            <span>HIPAA-aligned · Audit-logged · FHIR R4</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">Demo tenant</span>
          </div>
        </div>
      </footer>

      {/* ── Sticky CTA ───────────────────────────────────────── */}
      {showSticky && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
                <Mic className="h-4 w-4" />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Demo tenant ready</span>
                <span className="text-[11px] text-muted-foreground">
                  Cardinal Health Systems · Professional · Trial
                </span>
              </div>
            </div>
            <Button onClick={onEnter} className="bg-primary text-primary-foreground">
              Enter Platform <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
