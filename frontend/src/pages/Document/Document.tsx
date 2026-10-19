import { Link, useParams } from 'react-router';
import ReviewReminder from '../../components/ReviewReminder/ReviewReminder';
import Reviews from '../../components/Reviews/Reviews';
import lawyers from '../../data/lawyers.json';
import { useDocument } from './hooks';
import type { DocumentProps } from './types';

export default function Document({ currentLawyerId }: DocumentProps) {
  const { id } = useParams<{ id: string }>();
  const { document, isLoading, error } = useDocument(id);
  const creator = lawyers.find((lawyer) => lawyer.id === document?.uploadedBy);

  return (
    <section className="mx-auto max-w-5xl px-4 py-6">
      <Link to="/" className="mb-4 inline-block text-sm text-indigo-600 hover:underline">
        &larr; All documents
      </Link>

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-slate-100" aria-label="Loading document" />
      ) : error || !document ? (
        <p className="text-slate-500">{error?.status === 404 ? 'Document not found.' : 'Could not load document.'}</p>
      ) : (
        <>
          <header>
            <h2 className="text-2xl font-semibold text-slate-900">{document.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Uploaded by <span className="font-medium text-slate-700">{creator?.name ?? 'Unknown'}</span>
            </p>
          </header>
          {document.reviewRequestedAt && (
            <div className="mt-4">
              <ReviewReminder requestedAt={document.reviewRequestedAt} />
            </div>
          )}
          <Reviews documentId={document.id} lawyerId={currentLawyerId} />
        </>
      )}
    </section>
  );
}
