import Image from "next/image";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ImageIcon, Sparkles } from "lucide-react";

import { FORM_CONTROL_BASE } from "@/constants/styles";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
    variant?: ButtonVariant;
};

export function Button({ className, variant = "secondary", ...props }: ButtonProps) {
    const variantClass = {
        primary: "border border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
        secondary: "border border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)]",
        ghost: "border border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
        danger: "border border-[var(--color-error)]/35 bg-transparent text-[var(--color-error)] hover:bg-[var(--color-error)]/10",
    }[variant];

    return (
        <button
            className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-[background-color,border-color,opacity,color] disabled:cursor-not-allowed disabled:opacity-50",
                variantClass,
                className
            )}
            {...props}
        />
    );
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
    return <input className={cn(FORM_CONTROL_BASE, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
    return <textarea className={cn(FORM_CONTROL_BASE, "min-h-28", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
    return <select className={cn(FORM_CONTROL_BASE, className)} {...props} />;
}

type ChipProps = ComponentPropsWithoutRef<"span"> & {
    active?: boolean;
    tone?: "neutral" | "wine" | "gold";
};

export function Chip({ active = false, className, tone = "neutral", ...props }: ChipProps) {
    const toneClass = {
        neutral: active
            ? "border-[var(--border)] bg-[var(--surface-3)] text-[var(--text)]"
            : "border-[var(--chip-border)] bg-[var(--chip-bg)] text-[var(--chip-text)]",
        wine: "border-[var(--primary)]/35 bg-[var(--color-wine-red-soft)] text-[var(--text)]",
        gold: "border-[var(--color-gold)]/35 bg-[var(--color-gold-soft)] text-[var(--text)]",
    }[tone];

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                toneClass,
                className
            )}
            {...props}
        />
    );
}

type MetricCardProps = {
    label: string;
    value: ReactNode;
    detail?: ReactNode;
    accent?: "wine" | "gold" | "neutral";
    className?: string;
};

export function MetricCard({ label, value, detail, accent = "neutral", className }: MetricCardProps) {
    const accentClass = {
        wine: "text-[var(--primary)]",
        gold: "text-[var(--color-gold)]",
        neutral: "text-[var(--text)]",
    }[accent];

    return (
        <div className={cn("rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4", className)}>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">{label}</p>
            <div className={cn("mt-2 text-3xl font-semibold tracking-normal", accentClass)}>{value}</div>
            {detail ? <div className="mt-2 text-sm text-[var(--text-muted)]">{detail}</div> : null}
        </div>
    );
}

type InsightPanelProps = {
    title: string;
    children: ReactNode;
    className?: string;
};

export function InsightPanel({ title, children, className }: InsightPanelProps) {
    return (
        <section className={cn("rounded-lg border border-[var(--color-gold)]/35 bg-[var(--color-gold-soft)] p-4", className)}>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <Sparkles size={16} className="text-[var(--color-gold)]" />
                {title}
            </div>
            <div className="text-sm leading-6 text-[var(--text-soft)]">{children}</div>
        </section>
    );
}

type WineImageFrameProps = {
    src?: string | null;
    alt: string;
    className?: string;
    imageClassName?: string;
    unoptimized?: boolean;
};

export function WineImageFrame({ src, alt, className, imageClassName, unoptimized }: WineImageFrameProps) {
    return (
        <div className={cn("relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--input-bg)]", className)}>
            {src ? (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    className={cn("object-contain p-3", imageClassName)}
                    sizes="(max-width: 768px) 80vw, 320px"
                    unoptimized={unoptimized}
                />
            ) : (
                <div className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                    <ImageIcon size={28} />
                    <span className="text-xs font-medium">画像なし</span>
                </div>
            )}
        </div>
    );
}
