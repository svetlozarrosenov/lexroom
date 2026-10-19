export type ErrorBannerProps = {
  message: string;
  /** Bold first line; omitted in the compact variant. */
  title?: string;
  /** Single-line, for tight places such as the header. */
  compact?: boolean;
};
