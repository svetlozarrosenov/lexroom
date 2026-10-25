import { useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import useSWRMutation from 'swr/mutation';
import { ApiError, fetcher, postJson } from '../../lib/fetcher';
import type { Review, ReviewEvent, StartReviewBody } from './types';

const URLs = {
  getReviewsByDocument: (documentId: string) => `/api/reviews/document/${documentId}`,
  getReview: (id: string) => `/api/reviews/${id}`,
  /** Completed reviews this month, counted against the plan. */
  getUsed: '/api/reviews/used',
  reviewEvents: (documentId: string) => `/api/reviews/events?documentId=${documentId}`,
  startReview: '/api/reviews',
  /** Refreshed after a 402: the backend marks the document as "requested, run it next month". */
  getDocument: (documentId: string) => `/api/documents/${documentId}`,
};

/** How many of the plan's reviews this month have been used: the completed ones. */
export function useUsed() {
  const { data, error, isLoading, mutate } = useSWR<number>(URLs.getUsed);
  return { used: data, error, isLoading, refresh: mutate };
}

export function useReviews(documentId: string) {
  const { data, error, isLoading, mutate } = useSWR<Review[]>(URLs.getReviewsByDocument(documentId));
  return { reviews: data ?? [], error, isLoading, refresh: mutate };
}

/** Newest first: replace the review if cached, otherwise put it on top. */
function upsertReview(reviews: Review[] | undefined, review: Review): Review[] {
  const current = reviews ?? [];
  return current.some((r) => r.id === review.id)
    ? current.map((r) => (r.id === review.id ? review : r))
    : [review, ...current];
}

/**
 * Listens to the document's review events over Server-Sent Events. On every event it
 * fetches only the affected review and swaps it into the cached list, no list refetch.
 * The list is refetched only after a reconnect, to catch up on anything missed.
 */
export function useReviewEvents(documentId: string) {
  const { mutate } = useSWRConfig();
  const { refresh: refreshUsed } = useUsed();

  useEffect(() => {
    const source = new EventSource(URLs.reviewEvents(documentId));
    const listKey = URLs.getReviewsByDocument(documentId);
    let connectedBefore = false;

    source.onopen = () => {
      if (connectedBefore) void mutate(listKey);
      connectedBefore = true;
    };

    source.onmessage = async (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as ReviewEvent;
      const review = await fetcher<Review>(URLs.getReview(event.reviewId));
      await mutate<Review[]>(listKey, (reviews) => upsertReview(reviews, review), { revalidate: false });
      // Only a completed review counts against the plan.
      if (event.type === 'status' && event.status === 'completed') void refreshUsed();
    };

    return () => source.close();
  }, [documentId, mutate, refreshUsed]);
}

export function useStartReview() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error, reset } = useSWRMutation(
    URLs.startReview,
    async (url: string, { arg }: { arg: StartReviewBody }) => {
      try {
        return await postJson<StartReviewBody, Review>(url, arg);
      } catch (error) {
        if (error instanceof ApiError && error.status === 402) await mutate(URLs.getDocument(arg.documentId));
        throw error;
      }
    },
  );
  return { startReview: trigger, isStarting: isMutating, error, reset };
}
