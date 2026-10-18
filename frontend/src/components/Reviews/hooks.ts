import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { postJson } from '../../lib/fetcher';
import type { Review, StartReviewBody } from './types';

const URLs = {
  getReviewsByDocument: (documentId: string) => `/api/reviews?documentId=${documentId}`,
  startReview: '/api/reviews',
};

const REVIEWS_REFRESH_MS = 3_000;

/** Poll only while a review is running; 0 turns polling off. */
const refreshWhileRunning = (reviews?: Review[]) =>
  reviews?.some((review) => review.status === 'running') ? REVIEWS_REFRESH_MS : 0;

export function useReviews(documentId: string) {
  const { data, error, isLoading, mutate } = useSWR<Review[]>(URLs.getReviewsByDocument(documentId), {
    refreshInterval: refreshWhileRunning,
  });
  return { reviews: data ?? [], error, isLoading, refresh: mutate };
}

export function useStartReview() {
  const { trigger, isMutating, error, reset } = useSWRMutation(
    URLs.startReview,
    (url: string, { arg }: { arg: StartReviewBody }) => postJson<StartReviewBody, Review>(url, arg),
  );
  return { startReview: trigger, isStarting: isMutating, error, reset };
}
