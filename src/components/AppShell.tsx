import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';
import { BottomNav } from './BottomNav';
import { StorageWarning } from './StorageWarning';
import { IconSparkles } from './icons';
import { useAppStore } from '../store/useAppStore';

export function AppShell({ children }: { children: ReactNode }) {
  const aiChat = useAppStore((state) => state.preferences.aiChat);

  return (
    <div className="frame">
      <header className="topbar">
        <Brand as="link" />
        <div className="topbar-actions">
          {aiChat ? (
            <Link to="/assistant" className="icon-button" aria-label="Ask the AI coach">
              <IconSparkles size={18} />
            </Link>
          ) : null}
          <span className="alpha-pill">alpha 0.3.1</span>
        </div>
      </header>
      <main className="main">
        <StorageWarning />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
