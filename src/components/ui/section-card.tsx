import React, { ReactNode } from 'react';

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
    // Mapping historic tones to slight variations if needed, or unify to standard white card
    // User requested unification, so we default to standard card bg (white).
    // 'soft' might be slightly simpler or different if desired, but let's stick to standard card styles.

    return (
        <section
            className={`
                mt-6 first:mt-0 
                bg-[var(--card-bg)]
                rounded-2xl 
                border border-[var(--border)]
                shadow-sm 
                px-4 py-5 md:px-6 md:py-6
                transition-shadow
                ${className}
            `}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex gap-3">
                    {icon && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-[var(--text-muted)] border border-gray-100">
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
