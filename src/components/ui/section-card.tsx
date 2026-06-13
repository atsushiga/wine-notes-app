import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SectionTone = 'neutral' | 'soft' | 'focus';

interface SectionCardProps {
    title: string;
    description?: string;
    icon?: ReactNode;
    right?: ReactNode;
    tone?: SectionTone;
    className?: string;
    children: ReactNode;
}

export function SectionCard({
    title,
    description,
    icon,
    right,
    tone = 'neutral',
    className = '',
    children,
}: SectionCardProps) {
    const toneClass = {
        neutral: 'bg-[var(--card-bg)]',
        soft: 'bg-[var(--surface-2)]',
        focus: 'border-[var(--color-gold)]/45 bg-[var(--surface-2)] shadow-[0_18px_50px_rgba(0,0,0,0.24)]',
    }[tone];

    return (
        <section
            className={cn(
                'mt-6 first:mt-0 rounded-lg border border-[var(--border)] px-4 py-5 shadow-[0_12px_40px_rgba(0,0,0,0.16)] transition-[border-color,background-color,box-shadow] md:px-6 md:py-6',
                toneClass,
                className
            )}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex gap-3">
                    {icon && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--input-bg)] text-[var(--text-soft)] border border-[var(--border)]">
                            {icon}
                        </div>
                    )}
                    <div>
                        <h3 className="text-base font-semibold text-[var(--text)] leading-6">
                            {title}
                        </h3>
                        {description && (
                            <p className="mt-0.5 text-sm leading-5 text-[var(--text-muted)]">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                {right && <div className="ml-4">{right}</div>}
            </div>

            <div>
                {children}
            </div>
        </section>
    );
}
