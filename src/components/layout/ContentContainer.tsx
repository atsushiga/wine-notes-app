import React, { ReactNode } from 'react';

type ContainerSize = 'form' | 'default' | 'wide';

interface ContentContainerProps {
    children: ReactNode;
    size?: ContainerSize;
    className?: string;
}

export function ContentContainer({
    children,
    size = 'default',
    className = ''
}: ContentContainerProps) {

    const maxWidthClass = {
        form: 'max-w-4xl',    // Focused form
        default: 'max-w-6xl', // Standard content
        wide: 'max-w-7xl',    // Dashboard / Dense lists
    }[size];

    return (
        <div className={`mx-auto w-full px-4 py-6 md:px-8 md:py-8 ${maxWidthClass} ${className}`}>
            {children}
        </div>
    );
}
