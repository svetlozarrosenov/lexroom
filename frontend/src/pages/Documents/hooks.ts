import useSWR from 'swr';
import type { Document } from './types';

const URLs = {
  getDocuments: '/api/documents',
};

export function useDocuments() {
  const { data, error, isLoading, mutate } = useSWR<Document[]>(URLs.getDocuments);
  return { documents: data ?? [], error, isLoading, refresh: mutate };
}
