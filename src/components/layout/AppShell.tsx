import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BarChart3,
  BookOpen,
  Compass,
  FolderUp,
  HelpCircle,
  Home,
  Moon,
  Settings,
  Sun,
  WifiOff,
} from 'lucide-react';
import { db } from '@/db';
import { updateSettings } from '@/db/actions';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { OnboardingTourModal } from '@/components/onboarding/OnboardingTourModal';

export function AppShell() {
  const { t, i18n } = useTranslation();
  const online = useOnlineStatus();
  const { setTourOpen } = useAppStore();
  const settings = useLiveQuery(() => db.settings.get('default'));

  const toggleLanguage = async () => {
    const next = i18n.language === 'vi' ? 'en' : 'vi';
    await i18n.changeLanguage(next);
    await updateSettings({ language: next });
  };

  const toggleTheme = async () => {
    const current = settings?.theme ?? 'system';
    const next = current === 'dark' ? 'light' : 'dark';
    await updateSettings({ theme: next });
  };

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: Home, end: true },
    { to: '/decks', label: t('nav.decks'), icon: BookOpen, end: false },
    { to: '/stats', label: t('nav.stats'), icon: BarChart3, end: false },
    { to: '/import-export', label: t('nav.importExport'), icon: FolderUp, end: false },
    { to: '/settings', label: t('nav.settings'), icon: Settings, end: false },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg text-primary-foreground shadow-sm">
              <Compass className="h-5 w-5" />
            </span>
            <span className="text-lg">{t('app.name')}</span>
          </Link>
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-border p-3 space-y-2">
          {!online && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
              <WifiOff className="h-3.5 w-3.5" />
              <span>{t('app.offline')}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              aria-label="Toggle language"
              className="flex-1"
            >
              {i18n.language === 'vi' ? '🇻🇳 VI' : '🇺🇸 EN'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
            >
              {settings?.theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTourOpen(true)}
              aria-label={t('nav.tour')}
              title={t('nav.tour')}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Topbar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Compass className="h-4 w-4" />
          </span>
          <span>{t('app.name')}</span>
        </Link>
        <div className="flex items-center gap-1.5">
          {!online && (
            <span
              className="rounded-full bg-amber-500/15 p-1.5 text-amber-700 dark:text-amber-300"
              title={t('app.offline')}
            >
              <WifiOff className="h-4 w-4" />
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={toggleLanguage} aria-label="Toggle language">
            {i18n.language === 'vi' ? 'VI' : 'EN'}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {settings?.theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="pb-24 md:pb-8 md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 backdrop-blur md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-[68px]">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <OnboardingTourModal />
      <ToastContainer />
    </div>
  );
}
