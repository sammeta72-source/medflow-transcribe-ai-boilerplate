"use client";
// MedFlow — Workforce Management (E1)
// KPI cards + Leaderboard / Shifts / Skills tabs + burnout-risk alert.
// Uses /api/medflow/wfm.

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Award, BadgeCheck, CalendarClock, Crown, Flame, Medal, RefreshCw,
  ShieldCheck, TrendingUp, Trophy, Users, Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFetch } from "@/hooks/medflow/useFetch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionError, SectionLoading, StatCard } from "./_shared";

interface LeaderEntry {
  id: string;
  name: string;
  role: string;
  avatar: string;
  jobs_completed: number;
  quality_score: number;
  avg_tat_hours: number;
  rework_rate: number;
  badges: string[];
  streak_days: number;
}
interface ShiftEntry {
  user_id: string;
  name: string;
  role: string;
  schedule: string[]; // 7 entries — Mon..Sun
}
interface SkillEntry {
  user_id: string;
  name: string;
  role: string;
  specialties: { name: string; proficiency: string; certifications: string[] }[];
}
interface WfmData {
  workforce_size: number;
  active_now: number;
  productivity_score: number;
  leaderboard: LeaderEntry[];
  shifts: ShiftEntry[];
  skills: SkillEntry[];
  stats: {
    total_jobs_today: number;
    avg_tat_hours: number;
    quality_avg: number;
    rework_rate: number;
    burnout_risk: number;
  };
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function roleBadgeClass(role: string): string {
  if (role === "QA Analyst") return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (role === "Medical Editor") return "bg-secondary/15 text-secondary border-secondary/30";
  return "bg-amber-100 text-amber-700 border-amber-300";
}

function profClass(prof: string): string {
  if (prof === "expert") return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (prof === "intermediate" || prof === "proficient") return "bg-secondary/15 text-secondary border-secondary/30";
  if (prof === "beginner" || prof === "novice") return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-muted text-muted-foreground";
}

function reworkTone(rate: number): { color: string; bar: string } {
  if (rate < 0.05) return { color: "text-emerald-700", bar: "bg-emerald-500" };
  if (rate < 0.10) return { color: "text-amber-700", bar: "bg-amber-500" };
  return { color: "text-red-700", bar: "bg-red-500" };
}

function medalFor(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Award className="h-4 w-4 text-orange-600" />;
  return <span className="text-[10px] font-bold text-muted-foreground">#{rank}</span>;
}

export function WorkforceMgmt() {
  const { data, loading, error, refresh } = useFetch<WfmData>("/api/medflow/wfm");
  const [tab, setTab] = useState("leaderboard");

  // Build the unique specialty set across all users — for the skills matrix columns
  const allSpecialties = useMemo(() => {
    const set = new Set<string>();
    data?.skills?.forEach(u => u.specialties?.forEach(s => set.add(s.name)));
    return Array.from(set);
  }, [data]);

  if (loading && !data) return (
    <div>
      <PageHeader title="Workforce Management" description="Shifts, productivity, skills, and gamification." icon={CalendarClock} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error && !data) return (
    <div>
      <PageHeader title="Workforce Management" description="Shifts, productivity, skills, and gamification." icon={CalendarClock} />
      <SectionError message={error ?? "Unknown"} onRetry={refresh} />
    </div>
  );

  const d = data!;
  const stats = d.stats ?? { total_jobs_today: 0, avg_tat_hours: 0, quality_avg: 0, rework_rate: 0, burnout_risk: 0 };

  return (
    <div>
      <PageHeader
        title="Workforce Management"
        description="Shifts, productivity, skills, and gamification across the offshore delivery team."
        icon={CalendarClock}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* KPI StatCards */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Workforce size" value={d.workforce_size} delta={`${d.active_now} on shift`} deltaTone="up" sub="Active workforce members" />
        <StatCard icon={Activity} label="Active now" value={d.active_now} delta={`${Math.round((d.active_now / Math.max(1, d.workforce_size)) * 100)}% on shift`} deltaTone="up" sub="Real-time activity" />
        <StatCard icon={Zap} label="Productivity score" value={`${d.productivity_score}%`} delta={`${stats.total_jobs_today} jobs today`} deltaTone="up" accent="text-secondary" />
        <StatCard icon={Trophy} label="Jobs today" value={stats.total_jobs_today} sub={`Avg TAT ${stats.avg_tat_hours?.toFixed(1)}h · Quality ${stats.quality_avg?.toFixed(1)}`} />
      </div>

      {/* Burnout-risk alert */}
      {stats.burnout_risk > 0 && (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-800">
          <Flame className="h-4 w-4" />
          <AlertTitle>Burnout-risk alert</AlertTitle>
          <AlertDescription>
            {stats.burnout_risk} workforce {stats.burnout_risk === 1 ? "member shows" : "members show"} burnout-risk indicators. Consider shift rebalancing and enforcing daily-off policy.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="leaderboard"><Trophy className="mr-1.5 h-3.5 w-3.5" /> Leaderboard</TabsTrigger>
          <TabsTrigger value="shifts"><CalendarClock className="mr-1.5 h-3.5 w-3.5" /> Shifts</TabsTrigger>
          <TabsTrigger value="skills"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Skills</TabsTrigger>
        </TabsList>

        {/* ── Leaderboard ───────────────────────────────────────────── */}
        <TabsContent value="leaderboard">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-secondary" /> Weekly Leaderboard
              </CardTitle>
              <CardDescription className="text-xs">Top performers ranked by jobs completed this week</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {d.leaderboard.length === 0 ? (
                <EmptyState icon={Users} message="No leaderboard data yet." />
              ) : (
                <div className="mf-scroll max-h-[640px] overflow-y-auto p-2">
                  <AnimatePresence>
                    {d.leaderboard.map((e, i) => {
                      const rank = i + 1;
                      const rework = reworkTone(e.rework_rate);
                      return (
                        <motion.div
                          key={e.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18, delay: i * 0.03 }}
                          className={cn(
                            "mb-2 flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30",
                            rank === 1 && "border-amber-300 bg-amber-50/40",
                            rank === 2 && "border-slate-300 bg-slate-50/40",
                            rank === 3 && "border-orange-300 bg-orange-50/30",
                            rank > 3 && "border-border bg-card"
                          )}
                        >
                          {/* Rank */}
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-muted/50">
                            {medalFor(rank)}
                          </div>
                          {/* Avatar + name + role */}
                          <Avatar className="h-10 w-10 border border-border">
                            <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">{e.avatar}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">{e.name}</p>
                              <Badge variant="outline" className={cn("text-[10px]", roleBadgeClass(e.role))}>{e.role}</Badge>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1"><BadgeCheck className="h-3 w-3" /> {e.jobs_completed} jobs</span>
                              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Quality {e.quality_score}%</span>
                              <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> TAT {e.avg_tat_hours?.toFixed(1)}h</span>
                              <span className="flex items-center gap-1 text-orange-600"><Flame className="h-3 w-3" /> {e.streak_days}d streak</span>
                            </div>
                            {/* Badges */}
                            {e.badges?.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {e.badges.map((b, idx) => (
                                  <span key={idx} className="rounded-full bg-secondary/15 px-2 py-0.5 text-[9px] font-semibold text-secondary border border-secondary/30">
                                    {b}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Rework rate (right-aligned) */}
                          <div className="w-28 shrink-0 text-right">
                            <div className="mb-1 flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">Rework</span>
                              <span className={cn("font-bold", rework.color)}>{(e.rework_rate * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div className={cn("h-full rounded-full", rework.bar)} style={{ width: `${Math.min(100, e.rework_rate * 100 * 5)}%` }} />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Shifts ───────────────────────────────────────────────── */}
        <TabsContent value="shifts">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-secondary" /> Weekly Shift Grid
              </CardTitle>
              <CardDescription className="text-xs">Mon–Sun · color-coded by role</CardDescription>
            </CardHeader>
            <CardContent className="mf-scroll-lg overflow-x-auto">
              {d.shifts.length === 0 ? (
                <EmptyState icon={CalendarClock} message="No shift assignments yet." />
              ) : (
                <table className="w-full border-separate border-spacing-1 text-[11px]">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-muted-foreground">Member</th>
                      {DAYS.map(dn => <th key={dn} className="p-2 text-center text-muted-foreground">{dn}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {d.shifts.map(s => (
                      <tr key={s.user_id}>
                        <td className="p-2">
                          <p className="font-semibold text-foreground">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.role}</p>
                        </td>
                        {s.schedule.map((slot, idx) => {
                          const isOff = !slot || slot === "—";
                          return (
                            <td key={idx} className="p-2 text-center">
                              {isOff ? (
                                <span className="text-[10px] text-muted-foreground/60">—</span>
                              ) : (
                                <span className={cn(
                                  "inline-block rounded-md border px-1.5 py-1 text-[10px] font-semibold",
                                  roleBadgeClass(s.role)
                                )}>
                                  {slot}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Skills ───────────────────────────────────────────────── */}
        <TabsContent value="skills">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-secondary" /> Skills Matrix
              </CardTitle>
              <CardDescription className="text-xs">User × specialty proficiency + certifications</CardDescription>
            </CardHeader>
            <CardContent className="mf-scroll-lg overflow-x-auto">
              {d.skills.length === 0 ? (
                <EmptyState icon={ShieldCheck} message="No skill assignments yet." />
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-muted-foreground">Member</th>
                      {allSpecialties.map(s => (
                        <th key={s} className="p-2 text-center text-[10px] text-muted-foreground">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.skills.map(u => (
                      <tr key={u.user_id} className="border-t border-border">
                        <td className="p-2">
                          <p className="font-semibold text-foreground">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground">{u.role}</p>
                        </td>
                        {allSpecialties.map(s => {
                          const sk = u.specialties.find(x => x.name === s);
                          return (
                            <td key={s} className="p-2 text-center align-top">
                              {sk ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className={cn(
                                    "inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                                    profClass(sk.proficiency)
                                  )}>
                                    {sk.proficiency}
                                  </span>
                                  {(() => {
                                    const certs = typeof sk.certifications === 'string'
                                      ? sk.certifications.split(',').filter(Boolean)
                                      : (Array.isArray(sk.certifications) ? sk.certifications : []);
                                    return certs.length > 0 ? (
                                      <div className="flex flex-wrap justify-center gap-0.5">
                                        {certs.map((c: string, ci: number) => (
                                          <span key={ci} className="rounded bg-primary/10 px-1 text-[8px] font-bold text-primary">{c}</span>
                                        ))}
                                      </div>
                                    ) : null;
                                  })()}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/40">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer legend */}
      <p className="mt-3 text-[11px] text-muted-foreground">
        <TrendingUp className="mr-1 inline h-3 w-3" />
        Leaderboard, shift, and skill data refreshes from <code className="rounded bg-muted px-1">/api/medflow/wfm</code>. Burnout-risk flag triggers at sustained &gt; 8h/day shift load.
      </p>
    </div>
  );
}
