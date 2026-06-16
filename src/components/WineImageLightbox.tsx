'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

import { isProtectedImageUrl } from '@/lib/protectedImage';

export type ExpandedWineImage = {
    src: string;
    alt: string;
};

export function WineImageLightbox({ image, onClose }: { image: ExpandedWineImage | null; onClose: () => void }) {
    useEffect(() => {
        if (!image) return;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [image, onClose]);

    if (!image) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/88 px-4 py-8"
            role="dialog"
            aria-modal="true"
            aria-label="ワイン画像の拡大表示"
            onClick={onClose}
        >
            <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/20"
                aria-label="拡大画像を閉じる"
            >
                <X size={22} />
            </button>
            <figure
                className="relative h-[82vh] w-[92vw] max-w-6xl overflow-hidden rounded-lg"
                onClick={(event) => event.stopPropagation()}
            >
                <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    unoptimized={isProtectedImageUrl(image.src)}
                />
            </figure>
        </div>
    );
}
