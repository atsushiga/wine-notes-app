import React, { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    accentColor?: string; // Optional hex or CSS var for the specific accent bar
}

export function PageHeader({
    title,
    subtitle,
    actions,
    accentColor
}: PageHeaderProps) {

    const borderStyle = accentColor
        ? { borderLeftColor: accentColor }
        : { borderLeftColor: 'var(--accent)' };

    return (
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div
                className="pl-3 md:pl-5 border-l-4 py-1"
                style={borderStyle}
            >
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
                    {title}
                </h1>
                {subtitle && (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {subtitle}
                    </p>
                )}
            </div>

            {
                actions && (
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        {actions}
                    </div>
                )
            }
        </div >
    );
}
