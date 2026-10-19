import type { ReviewStatus, ReviewStatusBadgeProps } from './types';

const styles: Record<ReviewStatus, string> = {
  running: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
};

const labels: Record<ReviewStatus, string> = {
  running: 'In progress',
  completed: 'Completed',
  failed: 'Failed',
};

export default function ReviewStatusBadge({ status }: ReviewStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold uppercase ${styles[status]}`}
    >
      {status === 'running' && (
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
        />
      )}
      {labels[status]}
    </span>
  );
}
