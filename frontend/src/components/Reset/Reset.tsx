import { useNavigate } from 'react-router';
import ErrorBanner from '../ErrorBanner/ErrorBanner';
import { useRemoveAllFindings, useRemoveAllReviews } from './hooks';
import { URLs } from '../../pages/Documents/hooks';
import {mutate} from 'swr'

export default function Reset() {
  const navigate = useNavigate();
  const findings = useRemoveAllFindings();
  const reviews = useRemoveAllReviews();

  const isResetting = findings.isRemoving || reviews.isRemoving;
  const error = findings.error ?? reviews.error;

  async function handleReset() {
    if (!window.confirm('Delete all reviews and their findings?')) return;
    // A hook keeps its error until it runs again; clear both so a retry starts clean.
    findings.reset();
    reviews.reset();
    try {
      await findings.removeAllFindings();
      await reviews.removeAllReviews();
      mutate(URLs.getDocuments);
      navigate('/');
    } catch {
      // the failing hook exposes its error, rendered below
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && <ErrorBanner compact message={`Reset failed: ${error.message}`} />}
      <button
        type="button"
        onClick={handleReset}
        disabled={isResetting}
        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-red-400 hover:text-red-600 disabled:opacity-60"
      >
        {isResetting ? 'Resetting…' : 'Reset application'}
      </button>
    </div>
  );
}
