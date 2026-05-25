import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { FlaskConical, Dna, ArrowRight } from 'lucide-react';

interface SimCard {
  to: string;
  title: string;
  blurb: string;
  Icon: typeof FlaskConical;
  accent: string;
}

const SIMS: SimCard[] = [
  {
    to: '/electrophoresis',
    title: 'Gel Electrophoresis',
    blurb: 'Load DNA samples into wells and run the gel to separate fragments by size.',
    Icon: FlaskConical,
    accent: 'text-blue-400',
  },
  {
    to: '/streak',
    title: 'Streaking — CRISPR Plating',
    blurb: 'Spread transformed bacteria across an agar plate to isolate single colonies.',
    Icon: Dna,
    accent: 'text-emerald-400',
  },
];

export function ChooseSim() {
  return (
    <div className="w-full min-h-screen bg-neutral-900 text-white font-sans select-none flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold">Bio Lab Sims</h1>
        <p className="text-neutral-400 mt-2 text-sm sm:text-base">
          Choose a technique to practice.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
        {SIMS.map(({ to, title, blurb, Icon, accent }) => (
          <motion.div key={to} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}>
            <Link
              to={to}
              className="group flex flex-col h-full bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 rounded-2xl p-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Icon className={`w-8 h-8 ${accent}`} />
              <h2 className="text-lg font-semibold mt-4 flex items-center gap-2">
                {title}
              </h2>
              <p className="text-sm text-neutral-400 mt-2 flex-1">{blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-300 group-hover:text-white">
                Open
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
