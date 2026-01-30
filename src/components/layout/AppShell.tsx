import React from 'react';

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    return (
        <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text)] transition-colors duration-300">
            {children}
        </div>
    );
}
