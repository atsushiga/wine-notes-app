'use client';

import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Image from 'next/image';
import { WineImage } from '@/types/custom';
import { ChevronLeft, ChevronRight, ImageIcon, ZoomIn } from 'lucide-react';
import { isProtectedImageUrl } from '@/lib/protectedImage';
import { EmptyState } from '@/components/ui/primitives';

type CarouselOpenImage = {
    src: string;
    alt: string;
};

interface PropType {
    images: WineImage[];
    wineName: string;
    onImageOpen?: (image: CarouselOpenImage) => void;
}

const ImageCarousel: React.FC<PropType> = ({ images, wineName, onImageOpen }) => {
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
    const [selectedIndex, setSelectedIndex] = useState(0);

    const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        emblaApi.on('select', onSelect);
        emblaApi.on('reInit', onSelect);
        return () => {
            emblaApi.off('select', onSelect);
            emblaApi.off('reInit', onSelect);
        };
    }, [emblaApi, onSelect]);

    if (!images || images.length === 0) {
        return (
            <EmptyState
                icon={<ImageIcon size={24} />}
                title="画像なし"
                description="ラベル写真を追加すると、このワインを視覚的に探しやすくなります。"
                className="flex aspect-[3/4] flex-col items-center justify-center"
            />
        );
    }

    // Sort by display_order
    const sortedImages = [...images].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    return (
        <div className="relative group">
            <div className="overflow-hidden bg-[var(--surface-2)] rounded-2xl aspect-[3/4]" ref={emblaRef}>
                <div className="flex h-full touch-pan-y">
                    {sortedImages.map((img, index) => {
                        const alt = `${wineName} - ${index + 1}`;
                        const image = (
                            <>
                                {/* We use the original URL for main display, but could fallback to thumbnail if needed for speed */}
                                <Image
                                    src={img.url}
                                    alt={alt}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                    priority={index === 0}
                                    unoptimized={isProtectedImageUrl(img.url)}
                                />
                            </>
                        );

                        return (
                            <div className="relative flex-[0_0_100%] min-w-0" key={img.id || index}>
                                {onImageOpen ? (
                                    <button
                                        type="button"
                                        onClick={() => onImageOpen({ src: img.url, alt })}
                                        className="group/image relative block h-full w-full cursor-zoom-in"
                                        aria-label={`${alt}を拡大`}
                                    >
                                        {image}
                                        <span className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover/image:opacity-100 group-focus-visible/image:opacity-100">
                                            <ZoomIn size={17} />
                                        </span>
                                    </button>
                                ) : (
                                    image
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Navigation Buttons */}
            {sortedImages.length > 1 && (
                <>
                    <button
                        className="absolute left-2 top-1/2 z-10 -translate-y-1/2 bg-[var(--card-bg)]/60 hover:bg-[var(--card-bg)]/80 p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 border border-[var(--border)]"
                        onClick={scrollPrev}
                        aria-label="前の画像"
                    >
                        <ChevronLeft className="w-6 h-6 text-[var(--text)]" />
                    </button>
                    <button
                        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 bg-[var(--card-bg)]/60 hover:bg-[var(--card-bg)]/80 p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 border border-[var(--border)]"
                        onClick={scrollNext}
                        aria-label="次の画像"
                    >
                        <ChevronRight className="w-6 h-6 text-[var(--text)]" />
                    </button>

                    {/* Dots */}
                    <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-2">
                        {sortedImages.map((_, index) => (
                            <button
                                key={index}
                                className={`w-2 h-2 rounded-full transition-all ${index === selectedIndex
                                    ? 'bg-white w-4'
                                    : 'bg-white/50 hover:bg-white/80'
                                    }`}
                                onClick={() => emblaApi && emblaApi.scrollTo(index)}
                                aria-label={`${index + 1}枚目の画像を表示`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ImageCarousel;
