import { useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { fetcher } from '../../lib/fetcher';
import { usePlan } from '../../components/Plan/hooks';
import type { Document, ReviewEvent } from './types';

const URLs = {
  getDocuments: '/api/documents',
  getDocument: (id: string) => `/api/documents/${id}`,
  reviewEvents: '/api/reviews/events',
};

export function useDocuments() {
  const { data, error, isLoading, mutate } = useSWR<Document[]>(URLs.getDocuments);
  return { documents: data ?? [], error, isLoading, refresh: mutate };
}

/**
 * Keeps the list's "latest review" column live. On every review event it fetches only
 * the affected document and swaps it into the cached list, no list refetch. The list is
 * refetched only after a reconnect, to catch up on events missed while offline.
 */
export function useDocumentEvents() {
  const { mutate } = useSWRConfig();
  const { refresh: refreshPlan } = usePlan();

  useEffect(() => {
    const source = new EventSource(URLs.reviewEvents);
    let connectedBefore = false;

    source.onopen = () => {
      if (connectedBefore) void mutate(URLs.getDocuments);
      connectedBefore = true;
    };

    source.onmessage = async (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as ReviewEvent;
      const updated = await fetcher<Document>(URLs.getDocument(event.documentId));
      await mutate<Document[]>(
        URLs.getDocuments,
        (documents) => documents?.map((d) => (d.id === updated.id ? updated : d)),
        { revalidate: false },
      );
      // Only a completed review counts against the plan.
      if (event.type === 'status' && event.status === 'completed') void refreshPlan();
    };

    return () => source.close();
  }, [mutate, refreshPlan]);
}
