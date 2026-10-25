import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { BottomNav } from './BottomNav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="frame">
      <header className="topbar">
        <Brand as="link" />
        <span className="alpha-pill">alpha 0.1</span>
      </header>
      <main className="main">{children}</main>
      <BottomNav />
    </div>
  );
}

export function Splash() {
  return (
    <div className="splash">
      <Brand />
      <p className="splash-note">Opening your diary…</p>
    </div>
  );
}
