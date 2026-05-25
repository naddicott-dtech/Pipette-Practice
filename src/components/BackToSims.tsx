import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function BackToSims() {
  return (
    <Link
      to="/"
      aria-label="All sims"
      className="fixed bottom-24 md:bottom-4 left-4 z-50 pointer-events-auto inline-flex items-center gap-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md text-neutral-200 hover:text-white text-xs sm:text-sm px-3 py-2 rounded-lg border border-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="hidden sm:inline">All sims</span>
    </Link>
  );
}
