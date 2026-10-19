import { useSWRConfig } from 'swr';
import useSWRMutation from 'swr/mutation';
import { ApiError } from '../../lib/fetcher';

const URLs = {
  removeAllFindings: '/api/findings',
  removeAllReviews: '/api/reviews',
  /** Not deleted; refreshed, because the plan's usage is counted from the reviews. */
  getPlan: '/api/plan',
};

async function del(url: string): Promise<void> {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
}

/** Matches every cached key for an endpoint, with or without query string. */
const keysUnder = (url: string) => (key: unknown) => typeof key === 'string' && key.startsWith(url);

export function useRemoveAllFindings() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error, reset } = useSWRMutation(URLs.removeAllFindings, del, {
    onSuccess: () => mutate(keysUnder(URLs.removeAllFindings)),
  });
  return { removeAllFindings: trigger, isRemoving: isMutating, error, reset };
}

export function useRemoveAllReviews() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error, reset } = useSWRMutation(URLs.removeAllReviews, del, {
    onSuccess: () => Promise.all([mutate(keysUnder(URLs.removeAllReviews)), mutate(URLs.getPlan)]),
  });
  return { removeAllReviews: trigger, isRemoving: isMutating, error, reset };
}
