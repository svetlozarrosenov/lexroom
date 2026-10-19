import type { AccordionProps } from './types';

export default function Accordion({ items }: AccordionProps) {
  return (
    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {items.map((item) => (
        <details key={item.id} open={item.defaultOpen} className={`group ${item.className ?? ''}`}>
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
            <span className="text-slate-400 transition-transform group-open:rotate-90" aria-hidden="true">
              &#9656;
            </span>
            <div className="min-w-0 flex-1">{item.summary}</div>
          </summary>
          <div className="border-t border-slate-100 px-4 py-4">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
