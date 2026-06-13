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
                "rounded-lg border border-[var(--border)] bg-[var(--card-bg)] shadow-[0_12px_40px_rgba(0,0,0,0.16)] transition-[border-color,background-color,box-shadow]",
                elevated && "bg-[var(--surface-2)] shadow-[0_18px_50px_rgba(0,0,0,0.24)]",
                className
            )}
        >
            {children}
        </div>
    );
}
