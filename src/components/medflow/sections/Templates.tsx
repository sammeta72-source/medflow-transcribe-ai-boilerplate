"use client";
// MedFlow — Document templates + specialty dictionaries.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList, Copy, FileStack, FileText, GitBranch, History, Plus, RefreshCw,
  Scissors, ScanLine, Settings as SettingsIcon, Stethoscope, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFetch } from "@/hooks/medflow/useFetch";
import { DOCUMENT_TEMPLATES } from "@/lib/medflow/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader, SectionError, SectionLoading } from "./_shared";

const TEMPLATE_ICONS: Record<string, typeof ClipboardList> = {
  ClipboardList, Users, FileText, Scissors, ScanLine, Stethoscope, GitBranch,
};

interface Template {
  id: string;
  name: string;
  documentType: string;
  specialty: string | null;
  sections: string[];
  versionNumber: string;
  status: string;
  updatedAt: string;
}

const DICTIONARY_ROWS = [
  { term: "MI", restricted: false, expansion: "Myocardial Infarction", category: "Cardiology" },
  { term: "SOB", restricted: false, expansion: "Shortness of Breath", category: "Pulmonary" },
  { term: "Pt", restricted: true, expansion: "Patient", category: "General — use 'patient'", note: "Avoid abbreviation for clarity" },
  { term: "H/o", restricted: true, expansion: "History of", category: "General — use 'history of'", note: "Spell out" },
  { term: "BS", restricted: true, expansion: "Blood Sugar / Bowel Sounds / Breath Sounds", category: "Ambiguous", note: "Always disambiguate" },
  { term: "OD", restricted: true, expansion: "Once Daily / Overdose / Right Eye (OD)", category: "Ambiguous", note: "Use 'once daily' or 'right eye'" },
  { term: "Tx", restricted: true, expansion: "Treatment / Transplant", category: "General — avoid", note: "Spell out" },
  { term: "Sx", restricted: true, expansion: "Symptoms", category: "General — avoid", note: "Spell out" },
  { term: "Dx", restricted: true, expansion: "Diagnosis", category: "General — avoid", note: "Spell out" },
  { term: "Ca", restricted: false, expansion: "Cancer / Calcium", category: "Oncology / Lab", note: "Use context" },
];

export function Templates() {
  const { data, loading, error, refresh } = useFetch<{ templates: Template[] }>("/api/medflow/templates");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [newSections, setNewSections] = useState<string[]>(["Subjective", "Objective", "Assessment", "Plan"]);
  const [newSection, setNewSection] = useState("");
  const [newName, setNewName] = useState("");

  const combined = useMemo(() => {
    if (!data?.templates) return DOCUMENT_TEMPLATES;
    return [
      ...data.templates.map(t => ({
        id: t.id, name: t.name, type: t.documentType,
        sections: t.sections, version: t.versionNumber, status: t.status,
      })),
      ...DOCUMENT_TEMPLATES.map(t => ({
        id: t.name, name: t.name, type: t.type, sections: t.sections,
        version: "v1.0", status: "active",
      })),
    ];
  }, [data]);

  if (loading) return (
    <div>
      <PageHeader title="Templates" description="Document templates and specialty dictionaries." icon={FileStack} />
      <SectionLoading rows={3} />
    </div>
  );
  if (error) return (
    <div>
      <PageHeader title="Templates" description="Document templates and specialty dictionaries." icon={FileStack} />
      <SectionError message={error} onRetry={refresh} />
    </div>
  );

  function addSection() {
    if (!newSection.trim()) return;
    setNewSections(s => [...s, newSection.trim()]);
    setNewSection("");
  }
  function removeSection(idx: number) {
    setNewSections(s => s.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Document templates with structured sections — used by the Structuring Agent."
        icon={FileStack}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setBuilderOpen(true)} className="bg-primary text-primary-foreground">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New template
            </Button>
          </>
        }
      />

      <Tabs defaultValue="templates">
        <TabsList className="mb-4">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="dictionary">Specialty dictionaries</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          {combined.length === 0 ? (
            <Card><CardContent><EmptyState icon={FileStack} message="No templates." /></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {combined.map((t, i) => {
                const Icon = TEMPLATE_ICONS[t.name.split(" ")[0]] ?? FileText;
                return (
                  <motion.div
                    key={`${t.id}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                  >
                    <Card className="h-full">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px]">{t.version}</Badge>
                            <Badge variant="outline" className={cn("text-[10px]", t.status === "active" ? "text-emerald-700 border-emerald-300 bg-emerald-50" : "")}>
                              {t.status}
                            </Badge>
                          </div>
                        </div>
                        <CardTitle className="mt-2 text-base">{t.name}</CardTitle>
                        <CardDescription className="text-xs">{t.type}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-1.5">
                          {t.sections.map(s => (
                            <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/70">
                              {s}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => toast.info(`Editing ${t.name}…`)}>
                            <SettingsIcon className="mr-1 h-3 w-3" /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toast.success("Template duplicated", { description: t.name })}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toast.info("Version history")}>
                            <History className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dictionary">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Specialty dictionaries</CardTitle>
                <CardDescription className="text-xs">Restricted abbreviations + canonical expansions</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {DICTIONARY_ROWS.filter(r => r.restricted).length} restricted
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Term</TableHead>
                    <TableHead className="text-[11px]">Expansion</TableHead>
                    <TableHead className="text-[11px]">Category</TableHead>
                    <TableHead className="text-[11px]">Status</TableHead>
                    <TableHead className="text-[11px]">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DICTIONARY_ROWS.map((r, i) => (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="hover:bg-muted/40"
                    >
                      <TableCell className="font-mono text-[12px] font-bold">{r.term}</TableCell>
                      <TableCell className="text-[12px]">{r.expansion}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{r.category}</TableCell>
                      <TableCell>
                        {r.restricted ? (
                          <Badge variant="outline" className="text-[10px] text-red-700 border-red-300 bg-red-50">Restricted</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">Allowed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] italic text-muted-foreground">{r.note ?? "—"}</TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New template dialog */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
            <DialogDescription>Define a structured-document template. The Structuring Agent will validate section completeness.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Template name</Label>
              <Input placeholder="e.g. SOAP Note v2" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div>
              <Label>Sections</Label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {newSections.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[11px] font-medium text-secondary">
                    {s}
                    <button onClick={() => removeSection(i)} className="text-muted-foreground hover:text-foreground">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add section…"
                  value={newSection}
                  onChange={e => setNewSection(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSection(); } }}
                />
                <Button type="button" variant="outline" onClick={addSection}>Add</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuilderOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!newName.trim()) { toast.error("Name required"); return; }
                toast.success(`Template "${newName}" saved`, { description: `${newSections.length} sections` });
                setBuilderOpen(false);
                setNewName("");
                setNewSections(["Subjective", "Objective", "Assessment", "Plan"]);
              }}
              className="bg-primary text-primary-foreground"
            >
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
