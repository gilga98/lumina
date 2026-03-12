/**
 * ImageService — Image compression and secure URL lifecycle.
 * Single Responsibility: image processing and memory management.
 */
export class ImageService {
  static MAX_DIMENSION = 1200;
  static JPEG_QUALITY = 0.7;

  constructor() {
    /** @type {string[]} Active object URLs that need revoking */
    this._activeURLs = [];
  }

  /**
   * Compress an image file using the Canvas API.
   * Mobile photos (5-10 MB) → ~200 KB JPEG.
   * @param {File} file
   * @returns {Promise<ArrayBuffer>}
   */
  async compress(file) {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    // Scale down if too large
    if (width > ImageService.MAX_DIMENSION || height > ImageService.MAX_DIMENSION) {
      const ratio = Math.min(
        ImageService.MAX_DIMENSION / width,
        ImageService.MAX_DIMENSION / height
      );
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => blob.arrayBuffer().then(resolve),
        'image/jpeg',
        ImageService.JPEG_QUALITY
      );
    });
  }

  /**
   * Create a temporary object URL from a decrypted blob.
   * Tracks it for later revocation.
   * @param {ArrayBuffer} buffer
   * @param {string} [mimeType='image/jpeg']
   * @returns {string} Object URL
   */
  createSecureURL(buffer, mimeType = 'image/jpeg') {
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    this._activeURLs.push(url);
    return url;
  }

  /**
   * Revoke all active object URLs — call when leaving the vault screen.
   * Prevents memory leaks by destroying decrypted images from memory.
   */
  revokeAll() {
    for (const url of this._activeURLs) {
      URL.revokeObjectURL(url);
    }
    this._activeURLs = [];
  }

  /**
   * Revoke a single URL.
   */
  revoke(url) {
    URL.revokeObjectURL(url);
    this._activeURLs = this._activeURLs.filter((u) => u !== url);
  }
}
