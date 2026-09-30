"use client";
// MedFlow — Workflow & Routing (J7 + A5)
// Two-panel: confidence-calibrated routing config (left) + visual workflow rule
// builder (right) with rule CRUD + a flow diagram.

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Bot, ChevronRight, Edit3, GitBranch, Plus, RefreshCw, Save, ShieldCheck,
  Stethoscope, Trash2, Workflow, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useFetch } from "@/hooks/medflow/useFetch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionError, SectionLoading } from "./_shared";

// ── Types ────────────────────────────────────────────────────────────────────
interface RoutingConfig {
  high_confidence_threshold: number;
  low_confidence_threshold: number;
  high_confidence_action: string;
  low_confidence_action: string;
  default_assignment: string;
  fairness_window: string;
  escalation_threshold_min: number;
  auto_assign_enabled: boolean;
}

interface RuleCondition {
  field: string;
  op: string;
  value: string | number;
}
interface RuleAction {
  type: string;
  target: string;
}
interface WorkflowRule {
  id: string;
  name: string;
  enabled: boolean;
  priority?: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

const ACTION_OPTIONS = [
  { value: "skip_editor_to_qa", label: "Skip editor → QA" },
  { value: "route_to_senior_editor", label: "Route to Senior Editor" },
  { value: "route_to_junior_editor", label: "Route to Junior Editor" },
  { value: "route_to_qa", label: "Route to QA" },
  { value: "auto_approve", label: "Auto-approve" },
  { value: "escalate", label: "Escalate to Ops Manager" },
];
const ASSIGNMENT_OPTIONS = [
  { value: "round_robin", label: "Round-robin" },
  { value: "least_loaded", label: "Least-loaded" },
  { value: "specialty_match", label: "Specialty match" },
  { value: "skill_match", label: "Skill match" },
];
const FAIRNESS_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const CONDITION_FIELDS = ["priority", "specialty", "ai_confidence", "doc_type", "provider", "time_of_day", "client"];
const CONDITION_OPS = ["=", "!=", ">", ">=", "<", "<=", "in"];
const ACTION_TYPES = [
  { value: "assign_role", label: "Assign role" },
  { value: "assign_team", label: "Assign team" },
  { value: "assign_oncall", label: "Assign on-call" },
  { value: "skip_to", label: "Skip to stage" },
  { value: "escalate", label: "Escalate" },
  { value: "tag", label: "Tag job" },
];
const ACTION_TARGETS = ["senior_editor", "junior_editor", "qa", "cardiology_team", "ortho_team", "ops_manager", "on_call", "STAT"];

const DEFAULT_CONFIG: RoutingConfig = {
  high_confidence_threshold: 0.95,
  low_confidence_threshold: 0.80,
  high_confidence_action: "skip_editor_to_qa",
  low_confidence_action: "route_to_senior_editor",
  default_assignment: "round_robin",
  fairness_window: "weekly",
  escalation_threshold_min: 30,
  auto_assign_enabled: true,
};

export function WorkflowRouting() {
  const cfgFetch = useFetch<RoutingConfig>("/api/medflow/routing-config");
  const rulesFetch = useFetch<{ rules: WorkflowRule[]; total: number }>("/api/medflow/workflow-rules");
  const [cfg, setCfg] = useState<RoutingConfig>(DEFAULT_CONFIG);
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [saveCfgSaving, setSaveCfgSaving] = useState(false);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [newRule, setNewRule] = useState<{ name: string; priority: number; conditions: RuleCondition[]; actions: RuleAction[] }>({
    name: "",
    priority: 1,
    conditions: [{ field: "priority", op: "=", value: "STAT" }],
    actions: [{ type: "escalate", target: "ops_manager" }],
  });
  const [creatingRule, setCreatingRule] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Initialize local state from fetched data — don't show skeletons if data is present
  useEffect(() => {
    if (cfgFetch.data) setCfg(cfgFetch.data);
  }, [cfgFetch.data]);
  useEffect(() => {
    if (rulesFetch.data?.rules) setRules(rulesFetch.data.rules);
  }, [rulesFetch.data]);

  const totalLoading = cfgFetch.loading && !cfgFetch.data;
  const totalError = cfgFetch.error ?? rulesFetch.error;

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  }, [rules]);

  const saveConfig = async () => {
    setSaveCfgSaving(true);
    try {
      const res = await fetch("/api/medflow/routing-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if (json.config) setCfg(json.config);
      toast.success("Routing configuration saved.");
      cfgFetch.refresh();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaveCfgSaving(false);
    }
  };

  const toggleRuleEnabled = async (r: WorkflowRule, value: boolean) => {
    setRules(prev => prev.map(x => x.id === r.id ? { ...x, enabled: value } : x));
    toast.info(`${r.name} ${value ? "enabled" : "disabled"}.`);
  };

  const deleteRule = async (r: WorkflowRule) => {
    setDeletingId(r.id);
    try {
      const res = await fetch("/api/medflow/workflow-rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if (json.rules) setRules(json.rules);
      toast.success(`Rule "${r.name}" deleted.`);
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const createRule = async () => {
    if (!newRule.name.trim()) { toast.error("Enter a rule name."); return; }
    setCreatingRule(true);
    try {
      const res = await fetch("/api/medflow/workflow-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRule.name.trim(),
          priority: newRule.priority,
          conditions: newRule.conditions,
          actions: newRule.actions,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if (json.rules) setRules(json.rules);
      toast.success(`Rule "${newRule.name.trim()}" created.`);
      setNewRuleOpen(false);
      setNewRule({ name: "", priority: 1, conditions: [{ field: "priority", op: "=", value: "STAT" }], actions: [{ type: "escalate", target: "ops_manager" }] });
      rulesFetch.refresh();
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    } finally {
      setCreatingRule(false);
    }
  };

  if (totalLoading) return (
    <div>
      <PageHeader title="Workflow & Routing" description="Visual rule builder + confidence-calibrated routing." icon={Workflow} />
      <SectionLoading rows={4} />
    </div>
  );
  if (totalError && !cfgFetch.data && !rulesFetch.data) return (
    <div>
      <PageHeader title="Workflow & Routing" description="Visual rule builder + confidence-calibrated routing." icon={Workflow} />
      <SectionError message={totalError} onRetry={() => { cfgFetch.refresh(); rulesFetch.refresh(); }} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Workflow & Routing"
        description="Visual rule builder + confidence-calibrated routing between AI, editors, and QA."
        icon={Workflow}
        actions={
          <Button variant="outline" size="sm" onClick={() => { cfgFetch.refresh(); rulesFetch.refresh(); }}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── LEFT — Routing configuration ───────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-secondary" /> Routing Configuration
            </CardTitle>
            <CardDescription className="text-xs">Confidence thresholds + actions for AI-produced drafts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Visual flow diagram */}
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AI Draft → Confidence Routing</p>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">
                  <Bot className="h-3 w-3" /> AI Draft
                </span>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">confidence ≥ {Math.round(cfg.high_confidence_threshold * 100)}%</span>
                <ArrowRight className="h-3 w-3 text-emerald-600" />
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                  <ShieldCheck className="h-3 w-3" /> Skip to QA
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">confidence {Math.round(cfg.low_confidence_threshold * 100)}–{Math.round(cfg.high_confidence_threshold * 100)}%</span>
                <ArrowRight className="h-3 w-3 text-amber-600" />
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                  <Edit3 className="h-3 w-3" /> Junior Editor
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">confidence &lt; {Math.round(cfg.low_confidence_threshold * 100)}%</span>
                <ArrowRight className="h-3 w-3 text-red-600" />
                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 font-semibold text-red-700">
                  <Stethoscope className="h-3 w-3" /> Senior Editor
                </span>
              </div>
            </div>

            {/* Thresholds */}
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs">High-confidence threshold (skip editor)</Label>
                  <span className="font-mono text-[11px] font-bold text-emerald-700">{Math.round(cfg.high_confidence_threshold * 100)}%</span>
                </div>
                <Slider
                  min={0} max={100} step={1}
                  value={[Math.round(cfg.high_confidence_threshold * 100)]}
                  onValueChange={(v) => setCfg(c => ({ ...c, high_confidence_threshold: v[0] / 100 }))}
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs">Low-confidence threshold (escalate to senior)</Label>
                  <span className="font-mono text-[11px] font-bold text-red-700">{Math.round(cfg.low_confidence_threshold * 100)}%</span>
                </div>
                <Slider
                  min={0} max={100} step={1}
                  value={[Math.round(cfg.low_confidence_threshold * 100)]}
                  onValueChange={(v) => setCfg(c => ({ ...c, low_confidence_threshold: v[0] / 100 }))}
                />
              </div>
            </div>

            {/* Action dropdowns */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">High-confidence action</Label>
                <Select value={cfg.high_confidence_action} onValueChange={(v) => setCfg(c => ({ ...c, high_confidence_action: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Low-confidence action</Label>
                <Select value={cfg.low_confidence_action} onValueChange={(v) => setCfg(c => ({ ...c, low_confidence_action: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Default assignment</Label>
                <Select value={cfg.default_assignment} onValueChange={(v) => setCfg(c => ({ ...c, default_assignment: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNMENT_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fairness window</Label>
                <Select value={cfg.fairness_window} onValueChange={(v) => setCfg(c => ({ ...c, fairness_window: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FAIRNESS_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Auto-assign toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Auto-assign</p>
                <p className="text-[11px] text-muted-foreground">Allow the Work Allocation Agent to auto-route new jobs.</p>
              </div>
              <Switch checked={cfg.auto_assign_enabled} onCheckedChange={(v) => setCfg(c => ({ ...c, auto_assign_enabled: v }))} />
            </div>

            <Button size="sm" className="bg-primary text-primary-foreground" onClick={saveConfig} disabled={saveCfgSaving}>
              {saveCfgSaving ? <Save className="mr-1.5 h-3.5 w-3.5 animate-pulse" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              {saveCfgSaving ? "Saving…" : "Save"}
            </Button>
          </CardContent>
        </Card>

        {/* ── RIGHT — Workflow rules ──────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-secondary" /> Workflow Rules
                </CardTitle>
                <CardDescription className="text-xs">{rules.length} rules — top-down priority order</CardDescription>
              </div>
              <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => setNewRuleOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New Rule
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sortedRules.length === 0 ? (
              <EmptyState icon={Workflow} message="No workflow rules yet. Create your first rule." />
            ) : (
              <div className="mf-scroll max-h-[640px] space-y-3 pr-2">
                <AnimatePresence>
                  {sortedRules.map((r, i) => (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                    >
                      <div className={cn("rounded-lg border p-3 transition-colors", r.enabled ? "border-border bg-card" : "border-dashed bg-muted/30 opacity-70")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="grid h-5 w-5 place-items-center rounded-md bg-secondary/15 text-[10px] font-bold text-secondary">{r.priority ?? i + 1}</span>
                              <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={r.enabled} onCheckedChange={(v) => toggleRuleEnabled(r, v)} aria-label={`Toggle ${r.name}`} />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toast.info(`Editing "${r.name}" — visual builder coming soon.`)}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-700" disabled={deletingId === r.id} onClick={() => deleteRule(r)}>
                              {deletingId === r.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                        {/* Conditions */}
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <span className="text-[10px] uppercase text-muted-foreground">IF</span>
                          {r.conditions.map((c, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                              {c.field} <span className="font-mono">{c.op}</span> <span className="font-mono">{String(c.value)}</span>
                            </span>
                          ))}
                          {r.conditions.length === 0 && <span className="text-[10px] text-muted-foreground italic">no conditions</span>}
                        </div>
                        {/* Actions */}
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-[10px] uppercase text-muted-foreground">THEN</span>
                          {r.actions.map((a, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-medium text-secondary border border-secondary/30">
                              {a.type} <ArrowRight className="h-2.5 w-2.5" /> {a.target}
                            </span>
                          ))}
                          {r.actions.length === 0 && <span className="text-[10px] text-muted-foreground italic">no actions</span>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── New Rule Dialog ───────────────────────────────────────────── */}
      <Dialog open={newRuleOpen} onOpenChange={setNewRuleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create workflow rule</DialogTitle>
            <DialogDescription>Define conditions and actions. The first matching rule (top-down priority) wins.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Rule name</Label>
                <Input value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))} placeholder="e.g. Cardiology → Cardiology team" className="h-9 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Input type="number" min={1} max={99} value={newRule.priority} onChange={e => setNewRule(r => ({ ...r, priority: Number(e.target.value) || 1 }))} className="h-9 text-xs" />
              </div>
            </div>

            {/* Conditions builder */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-xs">Conditions (all must match)</Label>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setNewRule(r => ({ ...r, conditions: [...r.conditions, { field: "specialty", op: "=", value: "Cardiology" }] }))}>
                  <Plus className="mr-1 h-3 w-3" /> Add condition
                </Button>
              </div>
              <div className="space-y-2">
                {newRule.conditions.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select value={c.field} onValueChange={(v) => setNewRule(r => ({ ...r, conditions: r.conditions.map((x, i) => i === idx ? { ...x, field: v } : x) }))}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITION_FIELDS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={c.op} onValueChange={(v) => setNewRule(r => ({ ...r, conditions: r.conditions.map((x, i) => i === idx ? { ...x, op: v } : x) }))}>
                      <SelectTrigger className="h-8 w-16 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-8 text-xs flex-1"
                      value={String(c.value)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const num = Number(raw);
                        setNewRule(r => ({ ...r, conditions: r.conditions.map((x, i) => i === idx ? { ...x, value: (!isNaN(num) && raw !== "") ? num : raw } : x) }));
                      }}
                    />
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-700" onClick={() => setNewRule(r => ({ ...r, conditions: r.conditions.filter((_, i) => i !== idx) }))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions builder */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-xs">Actions</Label>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setNewRule(r => ({ ...r, actions: [...r.actions, { type: "assign_role", target: "senior_editor" }] }))}>
                  <Plus className="mr-1 h-3 w-3" /> Add action
                </Button>
              </div>
              <div className="space-y-2">
                {newRule.actions.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select value={a.type} onValueChange={(v) => setNewRule(r => ({ ...r, actions: r.actions.map((x, i) => i === idx ? { ...x, type: v } : x) }))}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Select value={a.target} onValueChange={(v) => setNewRule(r => ({ ...r, actions: r.actions.map((x, i) => i === idx ? { ...x, target: v } : x) }))}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTION_TARGETS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-700" onClick={() => setNewRule(r => ({ ...r, actions: r.actions.filter((_, i) => i !== idx) }))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRuleOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" disabled={creatingRule} onClick={createRule}>
              {creatingRule ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              {creatingRule ? "Creating…" : "Create rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
