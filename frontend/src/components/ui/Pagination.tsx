import { ChevronLeft, ChevronRight } from 'lucide-react';

const SIZE_OPTIONS = [10, 15, 20];

export function Pagination({
  page,
  pages,
  total,
  size,
  onPage,
  onSizeChange,
}: {
  page: number;
  pages: number;
  total: number;
  size: number;
  onPage: (p: number) => void;
  onSizeChange?: (s: number) => void;
}) {
  if (total === 0) return (
    <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-3 text-sm text-gray-400">
      <span>0 resultados</span>
      {onSizeChange && <SizeSelect size={size} onSizeChange={onSizeChange} />}
    </div>
  );

  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  const pageNumbers: (number | '…')[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (page > 3) pageNumbers.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) pageNumbers.push(i);
    if (page < pages - 2) pageNumbers.push('…');
    pageNumbers.push(pages);
  }

  return (
    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3 text-sm text-gray-600 flex-wrap">
      <div className="flex items-center gap-3">
        <span>{from}–{to} de {total}</span>
        {onSizeChange && <SizeSelect size={size} onSizeChange={onSizeChange} />}
      </div>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          {pageNumbers.map((n, i) =>
            n === '…'
              ? <span key={`e${i}`} className="px-1 select-none">…</span>
              : (
                <button
                  key={n}
                  onClick={() => onPage(n as number)}
                  className={`w-8 h-8 rounded text-sm ${
                    page === n
                      ? 'bg-brand-900 text-white font-medium'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {n}
                </button>
              )
          )}
          <button
            onClick={() => onPage(page + 1)}
            disabled={page === pages}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function SizeSelect({ size, onSizeChange }: { size: number; onSizeChange: (s: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-gray-500">
      <span>Mostrar</span>
      <select
        value={size}
        onChange={e => onSizeChange(Number(e.target.value))}
        className="border border-gray-300 rounded-md px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
