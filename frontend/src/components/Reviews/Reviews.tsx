import Accordion from '../Accordion/Accordion';
import ErrorBanner from '../ErrorBanner/ErrorBanner';
import Findings from '../Findings/Findings';
import ReviewButton from '../ReviewButton/ReviewButton';
import ReviewStatusBadge from '../ReviewStatusBadge/ReviewStatusBadge';
import lawyers from '../../data/lawyers.json';
import { usePlan } from '../Plan/hooks';
import { useReviewEvents, useReviews, useStartReview } from './hooks';
import type { Review, ReviewStatus, ReviewsProps } from './types';

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });

/** A coloured edge per state, so a glance tells final from not final. */
const itemStyles: Record<ReviewStatus, string> = {
  running: 'border-l-4 border-l-indigo-500 bg-indigo-50/40',
  completed: 'border-l-4 border-l-emerald-500',
  failed: 'border-l-4 border-l-red-400 bg-red-50/30',
};

function plural(count: number) {
  return `${count} ${count === 1 ? 'finding' : 'findings'}`;
}

/** What the reader may take this review for: in progress, final, or incomplete. */
function Verdict({ review }: { review: Review }) {
  const count = review.findings?.length ?? 0;
  switch (review.status) {
    case 'running':
      return (
        <span className="font-medium text-indigo-700">
          New review · {plural(count)} so far · more may follow
        </span>
      );
    case 'completed':
      return <span className="text-slate-500">{plural(count)}</span>;
    case 'failed':
      return (
        <span className="font-medium text-red-700">
          Incomplete · failed after {plural(count)} · not a final result
        </span>
      );
  }
}

function ReviewSummary({ review }: { review: Review }) {
  const requester = lawyers.find((lawyer) => lawyer.id === review.lawyerId);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <ReviewStatusBadge status={review.status} />
      <span className="text-slate-900">{dateFormat.format(new Date(review.createdAt))}</span>
      <span className="text-slate-500">by {requester?.name ?? 'Unknown'}</span>
      <Verdict review={review} />
    </div>
  );
}

export default function Reviews({ documentId, lawyerId }: ReviewsProps) {
  const { reviews, isLoading, error: loadError } = useReviews(documentId);
  const { refresh: refreshPlan } = usePlan();
  const { startReview, isStarting, error: startError } = useStartReview();
  useReviewEvents(documentId);

  const running = reviews[0]?.status === 'running';
  // While a new review runs, the last final result stays open underneath it.
  const previousFinal = running ? reviews.findIndex((review) => review.status === 'completed') : -1;

  async function handleRunReview() {
    try {
      await startReview({ documentId, lawyerId });
    } catch {
      // error is exposed by the hook and rendered below
    } finally {
      // A failed review also shows up in the list, and the plan may have changed either way.
      await refreshPlan();
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-6">
        <h3 className="text-lg font-semibold text-slate-900">Reviews</h3>
        <ReviewButton onClick={handleRunReview} busy={isStarting} />
      </div>
      {startError && (
        <div className="mt-3">
          <ErrorBanner title="The review could not be started" message={startError.message} />
        </div>
      )}
      {running && (
        <p className="mt-3 text-sm text-indigo-700" aria-live="polite">
          A new review is in progress. Findings appear as the AI returns them; the last final result stays below
          until it finishes.
        </p>
      )}

      <div className="mt-4">
        {isLoading ? (
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" aria-label="Loading reviews" />
        ) : loadError ? (
          <ErrorBanner title="Could not load reviews" message={loadError.message} />
        ) : reviews.length === 0 ? (
          <p className="text-sm text-slate-500">No reviews yet.</p>
        ) : (
          <Accordion
            items={reviews.map((review, index) => ({
              id: review.id,
              defaultOpen: index === 0 || index === previousFinal,
              className: itemStyles[review.status],
              summary: <ReviewSummary review={review} />,
              content: (
                <Findings
                  findings={review.findings?.map((f) => f.content) ?? []}
                  pending={review.status === 'running'}
                  emptyMessage={review.status === 'failed' ? 'No findings before it failed' : undefined}
                />
              ),
            }))}
          />
        )}
      </div>
    </section>
  );
}
