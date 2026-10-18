import { useSWRConfig } from 'swr';
import useSWRMutation from 'swr/mutation';
import { ApiError } from '../../lib/fetcher';

const URLs = {
  removeAllFindings: '/api/findings',
  removeAllReviews: '/api/reviews',
  removeAllPlans: '/api/plan',
};

async function del(url: string): Promise<void> {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
}

/** Matches every cached key for an endpoint, with or without query string. */
const keysUnder = (url: string) => (key: unknown) => typeof key === 'string' && key.startsWith(url);

export function useRemoveAllFindings() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(URLs.removeAllFindings, del, {
    onSuccess: () => mutate(keysUnder(URLs.removeAllFindings)),
  });
  return { removeAllFindings: trigger, isRemoving: isMutating, error };
}

export function useRemoveAllReviews() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(URLs.removeAllReviews, del, {
    onSuccess: () => mutate(keysUnder(URLs.removeAllReviews)),
  });
  return { removeAllReviews: trigger, isRemoving: isMutating, error };
}

export function useRemoveAllPlans() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(URLs.removeAllPlans, del, {
    onSuccess: () => mutate(keysUnder(URLs.removeAllPlans)),
  });
  return { removeAllPlans: trigger, isRemoving: isMutating, error };
}
