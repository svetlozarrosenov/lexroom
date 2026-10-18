import useSWR from 'swr';
import type { Document } from './types';

const URLs = {
  getDocument: (id: string) => `/api/documents/${id}`,
};

export function useDocument(id: string | undefined) {
  const { data, error, isLoading } = useSWR<Document>(id ? URLs.getDocument(id) : null);
  return { document: data, error, isLoading };
}
