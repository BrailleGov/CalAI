import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { BottomNav } from './BottomNav';
import { StorageWarning } from './StorageWarning';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="frame">
      <header className="topbar">
        <Brand as="link" />
        <span className="alpha-pill">alpha 0.2.0</span>
      </header>
      <main className="main">
        <StorageWarning />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
