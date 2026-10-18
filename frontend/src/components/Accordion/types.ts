import type { ReactNode } from 'react';

export type AccordionItem = {
  id: string;
  summary: ReactNode;
  content: ReactNode;
  defaultOpen?: boolean;
};

export type AccordionProps = {
  items: AccordionItem[];
};
