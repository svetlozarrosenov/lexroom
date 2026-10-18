import { useNavigate } from 'react-router';
import { useRemoveAllFindings, useRemoveAllPlans, useRemoveAllReviews } from './hooks';

export default function Reset() {
  const navigate = useNavigate();
  const findings = useRemoveAllFindings();
  const reviews = useRemoveAllReviews();
  const plans = useRemoveAllPlans();

  const isResetting = findings.isRemoving || reviews.isRemoving || plans.isRemoving;
  const error = findings.error ?? reviews.error ?? plans.error;

  async function handleReset() {
    if (!window.confirm('Delete all reviews and reset the plan?')) return;
    try {
      await findings.removeAllFindings();
      await reviews.removeAllReviews();
      await plans.removeAllPlans();
      navigate('/');
    } catch {
      // the failing hook exposes its error, rendered below
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-red-600">Reset failed: {error.message}</span>}
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
