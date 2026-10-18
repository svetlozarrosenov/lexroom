import type { ReactNode } from 'react';

type HeaderProps = {
  children?: ReactNode;
};

export default function Header({ children }: HeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lexroom</h1>
          <p className="text-sm text-slate-500">Contract review</p>
        </div>
        {children}
      </div>
    </header>
  );
}
