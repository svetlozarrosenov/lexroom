import Accordion from '../Accordion/Accordion';
import Findings from '../Findings/Findings';
import ReviewButton from '../ReviewButton/ReviewButton';
import ReviewStatusBadge from '../ReviewStatusBadge/ReviewStatusBadge';
import lawyers from '../../data/lawyers.json';
import { usePlan } from '../Plan/hooks';
import { useReviews, useStartReview } from './hooks';
import type { Review, ReviewsProps } from './types';

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });

function ReviewSummary({ review }: { review: Review }) {
  const requester = lawyers.find((lawyer) => lawyer.id === review.lawyerId);
  const count = review.findings?.length ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <ReviewStatusBadge status={review.status} />
      <span className="text-slate-900">{dateFormat.format(new Date(review.createdAt))}</span>
      <span className="text-slate-500">by {requester?.name ?? 'Unknown'}</span>
      {review.status === 'completed' && (
        <span className="text-slate-500">
          {count} {count === 1 ? 'finding' : 'findings'}
        </span>
      )}
    </div>
  );
}

export default function Reviews({ documentId, lawyerId }: ReviewsProps) {
  const { reviews, isLoading, error: loadError, refresh: refreshReviews } = useReviews(documentId);
  const { refresh: refreshPlan } = usePlan();
  const { startReview, isStarting, error: startError } = useStartReview();

  async function handleRunReview() {
    try {
      await startReview({ documentId, lawyerId });
    } catch {
      // error is exposed by the hook and rendered below
    } finally {
      // A failed review also shows up in the list, and the plan may have changed either way.
      await Promise.all([refreshReviews(), refreshPlan()]);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-6">
        <h3 className="text-lg font-semibold text-slate-900">Reviews</h3>
        <ReviewButton onClick={handleRunReview} busy={isStarting} />
      </div>
      {startError && <p className="mt-2 text-sm text-red-600">{startError.message}</p>}

      <div className="mt-4">
        {isLoading ? (
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" aria-label="Loading reviews" />
        ) : loadError ? (
          <p className="text-sm text-red-600">Could not load reviews: {loadError.message}</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-slate-500">No reviews yet.</p>
        ) : (
          <Accordion
            items={reviews.map((review, index) => ({
              id: review.id,
              defaultOpen: index === 0,
              summary: <ReviewSummary review={review} />,
              content: <Findings findings={review.findings?.map((f) => f.content) ?? []} />,
            }))}
          />
        )}
      </div>
    </section>
  );
}
