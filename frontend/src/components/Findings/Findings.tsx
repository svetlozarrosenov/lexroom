import type { FindingsProps, Severity } from './types';

const severityStyles: Record<Severity, string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-200 text-slate-700',
};

export default function Findings({ findings, emptyMessage = 'No findings' }: FindingsProps) {
  if (findings.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {findings.map((finding, index) => (
        <li key={`${finding.clause ?? 'general'}-${finding.title}-${index}`} className="px-4 py-3">
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
    </ol>
  );
}
