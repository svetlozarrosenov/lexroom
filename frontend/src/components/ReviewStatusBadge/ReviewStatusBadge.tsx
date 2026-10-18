import type { ReviewStatus, ReviewStatusBadgeProps } from './types';

const styles: Record<ReviewStatus, string> = {
  running: 'bg-indigo-100 text-indigo-800 animate-pulse',
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
};

export default function ReviewStatusBadge({ status }: ReviewStatusBadgeProps) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${styles[status]}`}>{status}</span>
  );
}
