import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '@/db';
import { seedDatabaseIfEmpty } from '@/db/seed';
import { useTheme } from '@/hooks/useTheme';
import { useAppStore } from '@/store/useAppStore';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { DashboardPage } from '@/pages/DashboardPage';
import { DecksPage } from '@/pages/DecksPage';
import { DeckDetailPage } from '@/pages/DeckDetailPage';
import { StudyPage } from '@/pages/StudyPage';
import { ImportExportPage } from '@/pages/ImportExportPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const StatsPage = lazy(() =>
  import('@/pages/StatsPage').then((mod) => ({ default: mod.StatsPage }))
);

function Bootstrapper() {
  const { i18n } = useTranslation();
  const { setInitialized, setTourOpen } = useAppStore();
  const settings = useLiveQuery(() => db.settings.get('default'));

  useTheme(settings?.theme ?? 'system');

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await seedDatabaseIfEmpty();
      const current = await db.settings.get('default');
      if (!mounted) return;
      if (current?.language && i18n.language !== current.language) {
        await i18n.changeLanguage(current.language);
      }
      if (current && !current.onboardingCompleted) {
        setTourOpen(true);
      }
      setInitialized(true);
    };
    void init();
    return () => {
      mounted = false;
    };
  }, [i18n, setInitialized, setTourOpen]);

  useEffect(() => {
    if (settings?.language && i18n.language !== settings.language) {
      void i18n.changeLanguage(settings.language);
    }
  }, [settings?.language, i18n]);

  return null;
}

export function App() {
  const basename = import.meta.env.BASE_URL;

  return (
    <ErrorBoundary>
      <BrowserRouter basename={basename}>
        <Bootstrapper />
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/decks" element={<DecksPage />} />
            <Route path="/decks/:id" element={<DeckDetailPage />} />
            <Route path="/study/:deckId" element={<StudyPage />} />
            <Route
              path="/stats"
              element={
                <Suspense fallback={<Skeleton className="h-72 w-full" />}>
                  <StatsPage />
                </Suspense>
              }
            />
            <Route path="/import-export" element={<ImportExportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
