import type { FindingsProps, Severity } from './types';

const severityStyles: Record<Severity, string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-200 text-slate-700',
};

export default function Findings({ findings, emptyMessage = 'No findings', pending = false }: FindingsProps) {
  if (findings.length === 0 && !pending) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  // Rendered in arrival order but displayed bottom-up: the waiting row stays at the top and
  // every new finding takes its place right under it, the oldest ending up at the bottom.
  return (
    <ol className="flex flex-col-reverse overflow-hidden rounded-lg border border-slate-200 bg-white">
      {findings.map((finding, index) => (
        <li
          key={`${finding.clause ?? 'general'}-${finding.title}-${index}`}
          className={`border-t border-slate-100 px-4 py-3 last:border-t-0 ${pending ? 'animate-[finding-in_1.5s_ease-out]' : ''}`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase ${severityStyles[finding.severity]}`}
            >
              {finding.severity}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">
                {finding.clause ? (
                  <span className="mr-2 font-mono text-xs text-slate-500">Clause {finding.clause}</span>
                ) : (
                  <span className="mr-2 text-xs text-slate-500">General</span>
                )}
                {finding.title}
              </p>
              {finding.excerpt && (
                <blockquote className="mt-1 border-l-2 border-slate-300 pl-3 text-sm italic text-slate-600">
                  {finding.excerpt}
                </blockquote>
              )}
              <p className="mt-1 text-sm text-slate-700">{finding.explanation}</p>
            </div>
          </div>
        </li>
      ))}
      {pending && (
        <li aria-live="polite" className="border-t border-slate-100 bg-indigo-50/70 px-4 py-3 last:border-t-0">
          <div className="flex items-start gap-3">
            <span className="relative mt-1 flex h-3 w-3 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-500" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-indigo-800">Waiting for the next finding…</p>
              <div className="mt-2 space-y-1.5" aria-hidden="true">
                <div className="h-2 w-2/3 animate-pulse rounded bg-indigo-200" />
                <div className="h-2 w-1/2 animate-pulse rounded bg-indigo-200" />
              </div>
            </div>
          </div>
        </li>
      )}
    </ol>
  );
}
