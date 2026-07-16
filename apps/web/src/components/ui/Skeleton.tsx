import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("skeleton-shimmer radius-surface-inner", className)}
      aria-hidden
    />
  );
}

export function NoteCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "radius-surface mx-auto w-full max-w-xl border border-border/80 bg-card p-2.5 shadow-card sm:p-3",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-label="Loading note"
    >
      <div className="radius-surface-inner border border-border/70 bg-muted p-5 sm:p-6">
        <div className="flex justify-end">
          <Skeleton className="radius-control h-6 w-20" />
        </div>
        <Skeleton className="radius-control mt-6 h-10 w-28" />
        <Skeleton className="mt-3 h-4 w-36" />
        <Skeleton className="mt-5 h-4 w-full max-w-xs" />
      </div>
      <div className="mt-3 flex gap-2 px-1">
        <Skeleton className="radius-control h-10 w-32" />
        <Skeleton className="radius-control h-10 w-24" />
      </div>
    </div>
  );
}

export function SendFormSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-xl"
      role="status"
      aria-busy="true"
      aria-label="Loading send form"
    >
      <div className="radius-surface overflow-hidden border border-border/80 bg-card p-2 shadow-card">
        <div className="radius-surface-inner border border-brand/15 bg-brand-mist px-6 py-6 sm:px-8 sm:py-7">
          <Skeleton className="mx-auto h-3 w-14 bg-white/50" />
          <div className="mt-3 flex flex-nowrap justify-center gap-1.5">
            <Skeleton className="radius-control h-9 w-16 shrink-0 bg-white/55" />
            <Skeleton className="radius-control h-9 w-20 shrink-0 bg-white/55" />
            <Skeleton className="radius-control h-9 w-20 shrink-0 bg-white/55" />
            <Skeleton className="radius-control h-9 w-24 shrink-0 bg-white/55" />
          </div>
        </div>
        <div className="space-y-4 px-3 pb-3 pt-5 sm:px-4 sm:pb-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="radius-control h-13 w-full" />
          <Skeleton className="h-3 w-72 max-w-full" />
          <Skeleton className="radius-control h-13 w-full" />
        </div>
      </div>
    </div>
  );
}

export function InboxSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-xl space-y-6 text-center"
      role="status"
      aria-busy="true"
      aria-label="Loading inbox"
    >
      <Skeleton className="mx-auto h-9 w-28" />
      <Skeleton className="mx-auto h-4 w-64" />
      <Skeleton className="radius-control mx-auto h-14 w-44" />
      <div className="flex justify-center gap-2">
        <Skeleton className="radius-control h-10 w-24" />
        <Skeleton className="radius-control h-10 w-24" />
        <Skeleton className="radius-control h-10 w-20" />
      </div>
      <div className="radius-surface overflow-hidden border border-border/80 bg-card p-2 text-left shadow-card">
        <div className="radius-surface-inner overflow-hidden">
          <div className="flex gap-4 border-b border-border/60 bg-muted px-4 py-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-14" />
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border/40 px-4 py-3.5 last:border-0"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="radius-control h-6 w-16" />
              <Skeleton className="radius-control ml-auto h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-xl space-y-6 text-center"
      role="status"
      aria-busy="true"
      aria-label="Loading account"
    >
      <Skeleton className="mx-auto h-9 w-36" />
      <Skeleton className="mx-auto h-4 w-48" />
      <div className="flex justify-center gap-2">
        <Skeleton className="radius-control h-10 w-24" />
        <Skeleton className="radius-control h-10 w-20" />
      </div>
      <div className="radius-surface border border-border/80 bg-card p-6 text-left shadow-card">
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="radius-control mt-4 h-14 w-full" />
        <Skeleton className="radius-control mt-3 h-14 w-full" />
        <Skeleton className="radius-control mt-4 h-11 w-40" />
      </div>
    </div>
  );
}

export function PrivacySkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-xl space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading privacy"
    >
      <Skeleton className="mx-auto h-9 w-32" />
      <Skeleton className="mx-auto h-4 w-72" />
      <div className="mt-8 space-y-8 text-left">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6 max-w-sm" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
}

export function LandingSkeleton() {
  return (
    <div
      className="mx-auto flex min-h-[calc(100svh-7rem)] w-full max-w-3xl flex-col items-center justify-center space-y-8 text-center"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-16 w-72 sm:h-20 sm:w-[28rem]" />
      <Skeleton className="h-12 w-64 sm:h-16 sm:w-[22rem]" />
      <Skeleton className="mx-auto h-5 w-full max-w-md" />
      <Skeleton className="mx-auto h-5 w-3/4 max-w-sm" />
      <Skeleton className="radius-control mt-4 h-14 w-full max-w-lg" />
      <div className="flex gap-2">
        <Skeleton className="radius-control h-11 w-40" />
        <Skeleton className="radius-control h-11 w-36" />
      </div>
    </div>
  );
}
