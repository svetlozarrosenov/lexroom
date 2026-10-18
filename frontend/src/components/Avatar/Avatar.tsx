import type { AvatarProps } from './types';

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function Avatar({ lawyers, selectedId, onSelect }: AvatarProps) {
  const selected = lawyers.find((l) => l.id === selectedId) ?? lawyers[0];

  return (
    <label className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
        {initials(selected.name)}
      </span>
      <span className="flex flex-col">
        <select
          value={selected.id}
          onChange={(e) => onSelect(e.target.value)}
          className="cursor-pointer rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {lawyers.map((lawyer) => (
            <option key={lawyer.id} value={lawyer.id}>
              {lawyer.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{selected.title}</span>
      </span>
    </label>
  );
}
