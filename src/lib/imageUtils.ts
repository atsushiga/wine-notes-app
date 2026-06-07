import { parse } from 'exifr';

interface ExifCaptureDateTags {
    DateTimeOriginal?: unknown;
    CreateDate?: unknown;
    ModifyDate?: unknown;
}

function formatDateParts(year: number, month: number, day: number): string | null {
    const parsed = new Date(year, month - 1, day);
    if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() !== month - 1 ||
        parsed.getDate() !== day
    ) {
        return null;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatExifDateForInput(value: unknown): string | null {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
        return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }

    if (typeof value !== 'string') return null;

    const match = value.trim().match(/^(\d{4})[:/-](\d{2})[:/-](\d{2})/);
    if (!match) return null;

    return formatDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

export async function extractExifCaptureDate(file: File): Promise<string | null> {
    try {
        const tags = await parse(file, {
            pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
            reviveValues: false,
        }) as ExifCaptureDateTags | undefined;

        return (
            formatExifDateForInput(tags?.DateTimeOriginal) ||
            formatExifDateForInput(tags?.CreateDate) ||
            formatExifDateForInput(tags?.ModifyDate)
        );
    } catch (error) {
        console.warn('Failed to read EXIF capture date:', error);
        return null;
    }
}

/**
 * Generates a thumbnail from a given File object.
 * Resizes the image so that the longest side is at most `maxWidth` (default 300px).
 * Returns a Blob.
 */
export async function generateThumbnail(file: File, maxWidth: number = 300): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;

        img.onload = () => {
            URL.revokeObjectURL(url);

            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxWidth) {
                    width = Math.round((width * maxWidth) / height);
                    height = maxWidth;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas to Blob failed'));
                }
            }, 'image/jpeg', 0.8); // 80% quality JPEG
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
    });
}
