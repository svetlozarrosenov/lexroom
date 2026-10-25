import useSWR from 'swr';
import type { Plan } from './types';

const URLs = {
  getPlan: '/api/plan',
};

export function usePlan() {
  const { data, error, isLoading } = useSWR<Plan>(URLs.getPlan);
  return { plan: data, error, isLoading };
}
