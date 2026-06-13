import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
    children: ReactNode;
    className?: string;
    elevated?: boolean;
}

export function Card({ children, className = '', elevated = false }: CardProps) {
    return (
        <div
            className={cn(
                "rounded-lg border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)] transition-[border-color,background-color,box-shadow]",
                elevated && "bg-[var(--surface-2)] shadow-[var(--shadow-card-elevated)]",
                className
            )}
        >
            {children}
        </div>
    );
}
