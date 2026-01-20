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
