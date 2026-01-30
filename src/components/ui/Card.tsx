import React, { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string; // Allow extending specific margins etc.
}

export function Card({ children, className = '' }: CardProps) {
    return (
        <div
            className={`
        bg-[var(--card-bg)] 
        rounded-2xl 
        border border-[var(--border)] 
        shadow-sm 
        transition-shadow
        ${className}
      `}
        >
            {children}
        </div>
    );
}
