/**
 * Downscale and compress image for fast mobile upload and instant Gemini processing.
 * Reduces 5MB-15MB iPhone camera photos down to ~150KB while keeping text crisp.
 */
export async function compressImage(
  fileOrBase64: File | string,
  maxDimension = 1280,
  quality = 0.8
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions preserving aspect ratio
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Không thể khởi tạo bộ xử lý ảnh canvas'));
        return;
      }

      // Draw and export as compressed JPEG
      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

      resolve({
        base64: compressedDataUrl,
        mimeType: 'image/jpeg',
      });
    };

    img.onerror = () => {
      reject(new Error('Không thể tải hoặc giải mã hình ảnh này.'));
    };

    if (typeof fileOrBase64 === 'string') {
      img.src = fileOrBase64;
    } else {
      const reader = new FileReader();
      reader.onload = e => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Lỗi khi đọc file ảnh từ thiết bị.'));
      reader.readAsDataURL(fileOrBase64);
    }
  });
}
