import { Dna } from 'lucide-react';

export default function StreakApp() {
  return (
    <div className="w-full h-screen bg-neutral-900 text-white font-sans select-none flex flex-col items-center justify-center px-6 text-center">
      <Dna className="w-10 h-10 text-emerald-400" />
      <h1 className="text-xl sm:text-2xl font-bold mt-4">Streaking — CRISPR Plating</h1>
      <p className="text-neutral-400 mt-2 max-w-md text-sm sm:text-base">
        Simulation coming soon. You'll spread transformed bacteria across an agar plate
        with an inoculation loop to isolate single colonies.
      </p>
    </div>
  );
}
