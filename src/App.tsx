import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { ToastProvider, useToast } from './components/Toast';
import { AppShell } from './components/AppShell';
import { Onboarding } from './features/onboarding/Onboarding';
import { TodayPage } from './features/today/TodayPage';
import { FoodsPage } from './features/foods/FoodsPage';
import { RecipesPage } from './features/recipes/RecipesPage';
import { HistoryPage } from './features/history/HistoryPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { needsLegacyCheck, readLegacyState } from './lib/legacy';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function ThemeSync() {
  const theme = useAppStore((state) => state.settings.theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const resolve = () => (theme === 'system' ? (media.matches ? 'light' : 'dark') : theme);

    const apply = () => {
      const resolved = resolve();
      document.documentElement.dataset.theme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', resolved === 'light' ? '#f4f2ec' : '#08090a');
      try {
        localStorage.setItem('calai-theme', theme);
      } catch {
        // Storage can be blocked; the inline boot script falls back to the OS setting.
      }
    };

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return null;
}

function Root() {
  const onboarded = useAppStore((state) => state.onboarded);
  const toast = useToast();

  useEffect(() => {
    if (!needsLegacyCheck()) return;

    let cancelled = false;
    void readLegacyState().then((data) => {
      if (cancelled || !data) return;

      const current = useAppStore.getState();
      if (current.onboarded || current.entries.length > 0 || current.customFoods.length > 0) {
        return;
      }

      current.importData(data);
      toast('Restored your previous diary');
    });

    return () => {
      cancelled = true;
    };
  }, [toast]);

  if (!onboarded) return <Onboarding />;

  return (
    <AppShell>
      <Routes>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/day/:date" element={<TodayPage />} />
        <Route path="/foods" element={<FoodsPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <ScrollToTop />
        <ThemeSync />
        <Root />
      </ToastProvider>
    </HashRouter>
  );
}
