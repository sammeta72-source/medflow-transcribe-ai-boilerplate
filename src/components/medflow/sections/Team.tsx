"use client";
// MedFlow — Team (members, shifts, skills matrix).

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck, CalendarClock, Mail, Plus, RefreshCw, Shield, UserPlus, Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFetch } from "@/hooks/medflow/useFetch";
import { formatRelative } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionError, SectionLoading } from "./_shared";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  mfaEnabled: boolean;
  organization: string | null;
  skills: { specialty: string; proficiency: string; certifications: string[] }[];
  shifts: { dayOfWeek: number; startTime: string; endTime: string }[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Team() {
  const { data, loading, error, refresh } = useFetch<{ users: TeamUser[] }>("/api/medflow/team");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Medical Editor");

  const allSpecialties = useMemo(() => {
    const set = new Set<string>();
    data?.users.forEach(u => u.skills.forEach(s => set.add(s.specialty)));
    return Array.from(set);
  }, [data]);

  if (loading) return (
    <div>
      <PageHeader title="Team" description="Members, shifts, and skills matrix." icon={Users} />
      <SectionLoading rows={3} />
    </div>
  );
  if (error || !data) return (
    <div>
      <PageHeader title="Team" description="Members, shifts, and skills matrix." icon={Users} />
      <SectionError message={error ?? "Unknown"} onRetry={refresh} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Team"
        description="Members, shifts, and skills matrix for the Cardinal Health Systems tenant."
        icon={Users}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setInviteOpen(true)} className="bg-primary text-primary-foreground">
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Invite user
            </Button>
          </>
        }
      />

      <Tabs defaultValue="members">
        <TabsList className="mb-4">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        {/* ── Members ─────────────────────────────── */}
        <TabsContent value="members">
          <Card>
            <CardContent className="p-0">
              {data.users.length === 0 ? (
                <EmptyState icon={Users} message="No members yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px]">Name</TableHead>
                      <TableHead className="text-[11px]">Role</TableHead>
                      <TableHead className="text-[11px]">Status</TableHead>
                      <TableHead className="text-[11px]">Last login</TableHead>
                      <TableHead className="text-[11px]">MFA</TableHead>
                      <TableHead className="text-[11px]">Skills</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map((u, i) => (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: i * 0.02 }}
                        className="hover:bg-muted/40"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 border border-border">
                              <AvatarFallback className="bg-primary/10 text-[9px] font-bold text-primary">
                                {u.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-[12px] font-semibold text-foreground">{u.name}</p>
                              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Mail className="h-2.5 w-2.5" /> {u.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px]", u.status === "active" ? "text-emerald-700 border-emerald-300 bg-emerald-50" : "text-amber-700 border-amber-300 bg-amber-50")}>
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{formatRelative(u.lastLoginAt)}</TableCell>
                        <TableCell>
                          {u.mfaEnabled ? (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-700">
                              <BadgeCheck className="h-3 w-3" /> Enforced
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700">Pending</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.skills.slice(0, 3).map((s, idx) => (
                              <span key={idx} className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-foreground/70">
                                {s.specialty}
                              </span>
                            ))}
                            {u.skills.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{u.skills.length - 3}</span>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Shifts ──────────────────────────────── */}
        <TabsContent value="shifts">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-secondary" /> Weekly shift grid
              </CardTitle>
              <CardDescription className="text-xs">Mon–Sun · per-user shift blocks</CardDescription>
            </CardHeader>
            <CardContent className="mf-scroll-lg overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-[11px]">
                <thead>
                  <tr>
                    <th className="p-1 text-left text-muted-foreground">Member</th>
                    {DAYS.map(d => <th key={d} className="p-1 text-center text-muted-foreground">{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map(u => (
                    <tr key={u.id}>
                      <td className="p-1 font-semibold text-foreground">{u.name.split(" ")[0]}</td>
                      {DAYS.map((_, dIdx) => {
                        const shift = u.shifts.find(s => s.dayOfWeek === dIdx + 1);
                        return (
                          <td key={dIdx} className="p-1 text-center">
                            {shift ? (
                              <span className="inline-block rounded-md bg-secondary/15 px-1.5 py-1 text-[10px] font-semibold text-secondary">
                                {shift.startTime}–{shift.endTime}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Skills matrix ───────────────────────── */}
        <TabsContent value="skills">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-secondary" /> Skills matrix
              </CardTitle>
              <CardDescription className="text-xs">User × specialty proficiency</CardDescription>
            </CardHeader>
            <CardContent className="mf-scroll-lg overflow-x-auto">
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
                  {data.users.map(u => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="p-2 font-semibold text-foreground">{u.name}</td>
                      {allSpecialties.map(s => {
                        const skill = u.skills.find(sk => sk.specialty === s);
                        const prof = skill?.proficiency;
                        const tone = prof === "expert" ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                          : prof === "proficient" ? "bg-secondary/15 text-secondary border-secondary/40"
                          : prof === "novice" ? "bg-amber-100 text-amber-700 border-amber-300"
                          : "bg-muted text-muted-foreground";
                        return (
                          <td key={s} className="p-2 text-center">
                            {prof ? (
                              <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize", tone)}>
                                {prof}
                              </span>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
            <DialogDescription>Send an invitation email with role-based access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" placeholder="name@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Tenant Owner", "Provider", "Medical Editor", "QA Analyst", "Offshore Delivery Manager", "Billing User", "Auditor / Compliance Officer"].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              className="bg-primary text-primary-foreground"
              onClick={() => {
                if (!inviteEmail.includes("@")) { toast.error("Enter a valid email"); return; }
                toast.success(`Invitation sent to ${inviteEmail}`, { description: `Role: ${inviteRole}` });
                setInviteOpen(false);
                setInviteEmail("");
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
