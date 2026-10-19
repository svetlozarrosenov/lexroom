import type { ErrorBannerProps } from './types';

export default function ErrorBanner({ message, title, compact = false }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 text-red-800 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-3 text-sm'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-full bg-red-600 font-bold text-white ${
          compact ? 'h-4 w-4 text-[10px]' : 'mt-0.5 h-5 w-5 text-xs'
        }`}
      >
        !
      </span>
      <div className="min-w-0">
        {title && !compact && <p className="font-semibold">{title}</p>}
        <p className="text-red-700">{message}</p>
      </div>
    </div>
  );
}
