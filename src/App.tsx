import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { ToastProvider } from './components/Toast';
import { AppShell, Splash } from './components/AppShell';
import { Onboarding } from './features/onboarding/Onboarding';
import { TodayPage } from './features/today/TodayPage';
import { FoodsPage } from './features/foods/FoodsPage';
import { HistoryPage } from './features/history/HistoryPage';
import { SettingsPage } from './features/settings/SettingsPage';

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
  const hydrated = useAppStore((state) => state.hydrated);
  const onboarded = useAppStore((state) => state.onboarded);

  if (!hydrated) return <Splash />;
  if (!onboarded) return <Onboarding />;

  return (
    <AppShell>
      <Routes>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/day/:date" element={<TodayPage />} />
        <Route path="/foods" element={<FoodsPage />} />
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
