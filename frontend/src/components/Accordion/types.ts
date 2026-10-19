import type { ReactNode } from 'react';

export type AccordionItem = {
  id: string;
  summary: ReactNode;
  content: ReactNode;
  defaultOpen?: boolean;
  /** Extra classes on the item, e.g. a coloured edge for its state. */
  className?: string;
};

export type AccordionProps = {
  items: AccordionItem[];
};
