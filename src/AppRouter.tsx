import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChooseSim } from './ChooseSim';
import { BackToSims } from './components/BackToSims';

// Each simulation owns a heavy Three.js scene. Lazy-loading keeps only the
// active sim's bundle in memory — important on the Chromebooks these run on.
const ElectrophoresisApp = lazy(() => import('./App'));
const StreakApp = lazy(() => import('./streak/StreakApp'));

function LoadingScreen() {
  return (
    <div className="w-full h-screen bg-neutral-900 text-white flex items-center justify-center font-sans">
      <span className="animate-pulse text-sm tracking-wide text-neutral-400">
        Loading simulation…
      </span>
    </div>
  );
}

export default function AppRouter() {
  return (
    <HashRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<ChooseSim />} />
          <Route
            path="/electrophoresis"
            element={
              <>
                <ElectrophoresisApp />
                <BackToSims />
              </>
            }
          />
          <Route
            path="/streak"
            element={
              <>
                <StreakApp />
                <BackToSims />
              </>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
