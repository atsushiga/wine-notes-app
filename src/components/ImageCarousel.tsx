'use client';

import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Image from 'next/image';
import { WineImage } from '@/types/custom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PropType {
    images: WineImage[];
    wineName: string;
}

const ImageCarousel: React.FC<PropType> = ({ images, wineName }) => {
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
        onSelect();
        emblaApi.on('select', onSelect);
        emblaApi.on('reInit', onSelect);
    }, [emblaApi, onSelect]);

    if (!images || images.length === 0) return null;

    // Sort by display_order
    const sortedImages = [...images].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    return (
        <div className="relative group">
            <div className="overflow-hidden bg-gray-100 rounded-2xl aspect-[3/4]" ref={emblaRef}>
                <div className="flex h-full touch-pan-y">
                    {sortedImages.map((img, index) => (
                        <div className="relative flex-[0_0_100%] min-w-0" key={img.id || index}>
                            {/* We use the original URL for main display, but could fallback to thumbnail if needed for speed */}
                            <Image
                                src={img.url}
                                alt={`${wineName} - ${index + 1}`}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 50vw"
                                priority={index === 0}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation Buttons */}
            {sortedImages.length > 1 && (
                <>
                    <button
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white/80 p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                        onClick={scrollPrev}
                    >
                        <ChevronLeft className="w-6 h-6 text-gray-800" />
                    </button>
                    <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white/80 p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                        onClick={scrollNext}
                    >
                        <ChevronRight className="w-6 h-6 text-gray-800" />
                    </button>

                    {/* Dots */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                        {sortedImages.map((_, index) => (
                            <button
                                key={index}
                                className={`w-2 h-2 rounded-full transition-all ${index === selectedIndex
                                        ? 'bg-white w-4'
                                        : 'bg-white/50 hover:bg-white/80'
                                    }`}
                                onClick={() => emblaApi && emblaApi.scrollTo(index)}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ImageCarousel;
