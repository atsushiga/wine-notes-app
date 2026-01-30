import React, { ReactNode } from 'react';

interface FieldRowProps {
    label: string;
    valueText?: string | null;
    hint?: string;
    children: ReactNode;
    className?: string;
}

export const FieldRow: React.FC<FieldRowProps> = ({
    label,
    valueText,
    hint,
    children,
    className = '',
}) => {
    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-baseline justify-between gap-3">
                <div className="space-y-0.5">
                    <label className="text-sm font-medium text-[var(--text)] block text-left">
                        {label}
                    </label>
                    {hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
                </div>
                {valueText && (
                    <span className="text-sm font-medium text-[var(--text)] shrink-0">
                        {valueText}
                    </span>
                )}
            </div>
            <div>{children}</div>
        </div>
    );
};
