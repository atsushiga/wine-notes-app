import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils'; // Assuming cn utility exists, otherwise I'll need to check or use string concatenation
// Check if cn exists first? Usually it does in these setups.
// If not, I'll stick to a simple join or template literal in the file content below.
// Let's assume standard shadcn/tailwind setup usually has it. 
// If I am not sure, I can check imports in existing files. 
// WineForm uses standard specific classes. 
// I'll stick to template literals if I don't see `cn` imported in WineForm. 
// Modify: I will double check imports in WineForm to see if `cn` or `clsx` is used. 
// WineForm does NOT import `cn`.
// I will start without `cn` dependency to be safe or define a local helper if needed.

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
    const toneStyles = {
        neutral: 'bg-white',
        soft: 'bg-zinc-50/60',
        focus: 'bg-zinc-50',
    };

    return (
        <section
            className={`
                mt-8 first:mt-0 
                rounded-2xl border border-zinc-200/70 
                shadow-sm shadow-zinc-950/5 
                px-4 py-4 md:px-6 md:py-5
                ${toneStyles[tone]} 
                ${className}
            `}
        >
            <div className="flex items-start justify-between">
                <div className="flex gap-3">
                    {icon && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                            {icon}
                        </div>
                    )}
                    <div>
                        <h3 className="text-base font-semibold text-zinc-900 leading-6">
                            {title}
                        </h3>
                        {description && (
                            <p className="mt-0.5 text-sm leading-5 text-zinc-600">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                {right && <div className="ml-4">{right}</div>}
            </div>

            <div className="mt-4">
                {children}
            </div>
        </section>
    );
}
