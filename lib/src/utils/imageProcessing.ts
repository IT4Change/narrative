/**
 * Image processing utilities for avatars
 *
 * Handles image scaling, compression, and validation
 */

/**
 * Scales and compresses an image file to a data URL
 * @param file The image file to process
 * @param maxSize Maximum dimension (width/height) in pixels
 * @param quality JPEG quality (0-1), only used for non-PNG images
 * @returns Promise resolving to { dataUrl, sizeKB } or throws error
 */
export async function processImageFile(
  file: File,
  maxSize: number = 128,
  quality: number = 0.8
): Promise<{ dataUrl: string; sizeKB: number }> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }

    // Preserve PNG format for transparency support
    const isPng = file.type === 'image/png';

    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Calculate dimensions (square crop from center)
        const size = Math.min(img.width, img.height);
        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 2;

        // Set canvas size
        canvas.width = maxSize;
        canvas.height = maxSize;

        // Clear canvas for transparency (important for PNG)
        if (isPng) {
          ctx.clearRect(0, 0, maxSize, maxSize);
        }

        // Draw image (cropped and scaled)
        ctx.drawImage(
          img,
          offsetX,
          offsetY,
          size,
          size,
          0,
          0,
          maxSize,
          maxSize
        );

        // Convert to data URL - preserve PNG format for transparency
        const dataUrl = isPng
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);

        // Calculate size in KB
        const sizeBytes = Math.round((dataUrl.length * 3) / 4); // Approximate base64 size
        const sizeKB = Math.round(sizeBytes / 1024);

        resolve({ dataUrl, sizeKB });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Validates avatar data URL size
 * @param dataUrl The data URL to validate
 * @param maxKB Maximum size in kilobytes
 * @returns true if valid, false otherwise
 */
export function isAvatarSizeValid(dataUrl: string, maxKB: number = 50): boolean {
  const sizeBytes = Math.round((dataUrl.length * 3) / 4);
  const sizeKB = Math.round(sizeBytes / 1024);
  return sizeKB <= maxKB;
}
