import { reviewReminderMessage } from './message';
import type { ReviewReminderProps } from './types';

export default function ReviewReminder({ requestedAt }: ReviewReminderProps) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white"
      >
        !
      </span>
      <p>{reviewReminderMessage(requestedAt)}</p>
    </div>
  );
}
