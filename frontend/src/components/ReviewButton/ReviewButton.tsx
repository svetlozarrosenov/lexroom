import type { ReviewButtonProps } from './types';

export default function ReviewButton({ onClick, disabled = false, busy = false }: ReviewButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? 'Starting…' : 'Run AI review'}
    </button>
  );
}
