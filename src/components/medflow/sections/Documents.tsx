"use client";
// MedFlow — Documents (delivered / approved jobs table).

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Download, Eye, FileJson, FileText, FileText as FileTextIcon, RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFetch } from "@/hooks/medflow/useFetch";
import { STATUS_META } from "@/lib/medflow/constants";
import { formatDateTime, formatRelative } from "@/lib/medflow/format";
import type { JobWithRelations } from "@/lib/medflow/types";
import { EmptyState, PageHeader, SectionError, SectionLoading } from "./_shared";
import { toast } from "sonner";

export function Documents() {
  const { data, loading, error, refresh } = useFetch<{ jobs: JobWithRelations[] }>("/api/medflow/jobs");
  const [docType, setDocType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const jobs = useMemo(() => {
    if (!data?.jobs) return [];
    return data.jobs
      .filter(j => j.status === "Delivered" || j.status === "Approved")
      .filter(j => docType === "all" || j.documentType === docType)
      .filter(j => !search || j.jobNumber.toLowerCase().includes(search.toLowerCase()) || (j.patientRef ?? "").toLowerCase().includes(search.toLowerCase()));
  }, [data, docType, search]);

  const docTypes = useMemo(() => Array.from(new Set(data?.jobs?.map(j => j.documentType) ?? [])), [data]);

  if (loading) return (
    <div>
      <PageHeader title="Documents" description="Delivered and approved clinical documents." icon={FileTextIcon} />
      <SectionLoading rows={3} />
    </div>
  );
  if (error || !data) return (
    <div>
      <PageHeader title="Documents" description="Delivered and approved clinical documents." icon={FileTextIcon} />
      <SectionError message={error ?? "Unknown"} onRetry={refresh} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Delivered and approved clinical documents — download PDFs or inspect FHIR payloads."
        icon={FileTextIcon}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Doc type:</span>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="h-9 w-56 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {docTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <input
          type="search"
          placeholder="Search job # / patient…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 w-full max-w-xs rounded-md border border-border bg-card px-3 text-sm"
        />
      </div>

      {jobs.length === 0 ? (
        <Card><CardContent><EmptyState icon={FileText} message="No documents match the current filter." /></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Job #</TableHead>
                  <TableHead className="text-[11px]">Patient</TableHead>
                  <TableHead className="text-[11px]">Provider</TableHead>
                  <TableHead className="text-[11px]">Document</TableHead>
                  <TableHead className="text-[11px]">Status</TableHead>
                  <TableHead className="text-[11px]">Delivered</TableHead>
                  <TableHead className="text-[11px]">Method</TableHead>
                  <TableHead className="text-[11px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j, i) => {
                  const sm = STATUS_META[j.status];
                  return (
                    <motion.tr
                      key={j.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                      className="hover:bg-muted/40"
                    >
                      <TableCell className="font-mono text-[12px] font-semibold">{j.jobNumber}</TableCell>
                      <TableCell className="text-[12px]">{j.patientRef}</TableCell>
                      <TableCell className="text-[12px]">{j.provider?.name ?? "—"}</TableCell>
                      <TableCell className="text-[12px]">{j.documentType}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-l-4 text-[10px] font-semibold" style={{ borderLeftColor: sm.color }}>
                          {j.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{formatRelative(j.updatedAt)}</TableCell>
                      <TableCell className="text-[11px]">{j.deliveryDest ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => toast.info(`Opening ${j.jobNumber} viewer…`)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toast.success(`Downloaded ${j.jobNumber}.pdf`, { description: "PDF export mocked." })}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toast.info("Fetching FHIR payload…", { description: `Open the Job detail drawer for ${j.jobNumber} to view FHIR.` })}>
                            <FileJson className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        {jobs.length} of {data.jobs.filter(j => j.status === "Delivered" || j.status === "Approved").length} documents shown · Last updated {formatDateTime(new Date().toISOString())}
      </p>
    </div>
  );
}
