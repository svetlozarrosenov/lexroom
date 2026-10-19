import { usePlan } from './hooks';

export default function Plan() {
  const { plan, error, isLoading } = usePlan();
  console.log('crb_plan', plan)
  if (isLoading) {
    return <div className="h-9 w-40 animate-pulse rounded bg-slate-100" aria-label="Loading plan" />;
  }

  if (error || !plan) {
    return <div className="text-sm text-red-600">Plan unavailable</div>;
  }

  const { used } = plan;
  const exhausted = plan.remaining === 0;

  return (
    <div className="flex flex-col gap-1 text-sm" aria-live="polite">
      <div className="flex items-baseline gap-1">
        <span className={`font-semibold ${exhausted ? 'text-red-600' : 'text-slate-900'}`}>{plan.remaining}</span>
        <span className="text-slate-500">of {plan.max} reviews left this month</span>
      </div>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200" role="presentation">
        <div
          className={`h-full rounded-full ${exhausted ? 'bg-red-500' : 'bg-indigo-600'}`}
          style={{ width: `${(used / plan.max) * 100}%` }}
        />
      </div>
    </div>
  );
}
