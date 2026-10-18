import { useNavigate } from 'react-router';
import ReviewStatusBadge from '../../components/ReviewStatusBadge/ReviewStatusBadge';
import Table from '../../components/Table';
import { useDocuments } from './hooks';
import type { DocumentColumn } from './types';

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

const columns: DocumentColumn[] = [
  {
    key: 'title',
    header: 'Document',
    render: (doc) => <span className="font-medium text-slate-900">{doc.title}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    render: (doc) => (
      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{doc.type}</span>
    ),
  },
  {
    key: 'pages',
    header: 'Pages',
    className: 'text-right',
    render: (doc) => doc.pages,
  },
  {
    key: 'uploadedAt',
    header: 'Uploaded',
    render: (doc) => dateFormat.format(new Date(doc.uploadedAt)),
  },
  {
    key: 'latestReview',
    header: 'Latest review',
    render: (doc) =>
      doc.latestReview ? (
        <ReviewStatusBadge status={doc.latestReview.status} />
      ) : (
        <span className="text-xs text-slate-400">Not reviewed</span>
      ),
  },
  {
    key: 'findings',
    header: 'Findings',
    className: 'text-right',
    render: (doc) =>
      doc.latestReview ? doc.latestReview.findingsCount : <span className="text-slate-400">&ndash;</span>,
  },
];

export default function Documents() {
  const navigate = useNavigate();
  const { documents, isLoading, error } = useDocuments();

  return (
    <section className="mx-auto max-w-5xl px-4 py-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Documents</h2>
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-slate-100" aria-label="Loading documents" />
      ) : error ? (
        <p className="text-sm text-red-600">Could not load documents: {error.message}</p>
      ) : (
        <Table
          columns={columns}
          rows={documents}
          rowKey={(doc) => doc.id}
          emptyMessage="No documents in this workspace"
          onRowClick={(doc) => navigate(`/documents/${doc.id}`)}
        />
      )}
    </section>
  );
}
