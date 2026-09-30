"use client";
// Shared section primitives used across MedFlow section components.

import { motion } from "framer-motion";
import { type LucideIcon, RefreshCw, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold leading-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <TriangleAlert className="h-4 w-4" />
      <AlertTitle>Failed to load</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm">{message}</p>
    </div>
  );
}

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  sub?: string;
  accent?: string;
  spark?: number[];
}

export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaTone = "neutral",
  sub,
  accent = "text-secondary",
  spark,
}: StatCardProps) {
  const deltaClass =
    deltaTone === "up"
      ? "text-emerald-600"
      : deltaTone === "down"
        ? "text-red-600"
        : "text-muted-foreground";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            {delta && <span className={cn("text-[11px] font-semibold", deltaClass)}>{delta}</span>}
          </div>
          <p className="mt-3 text-2xl font-extrabold leading-none text-foreground">{value}</p>
          <p className="mt-1 text-[12px] font-medium text-muted-foreground">{label}</p>
          {sub && <p className={cn("text-[11px] font-medium", accent)}>{sub}</p>}
          {spark && (
            <div className="mt-2 flex h-6 items-end gap-0.5">
              {spark.map((v, i) => {
                const pct = Math.max(8, Math.min(100, v * 100));
                const opacity = 0.45 + (i / spark.length) * 0.55;
                return (
                  <span
                    key={i}
                    className="flex-1 rounded-sm bg-secondary/60"
                    style={{ height: pct + "%", opacity }}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
