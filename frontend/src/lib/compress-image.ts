const MAX_SIDE = 1200
/** Stay under the server's limit (400,000 bytes) with some room. */
const MAX_BYTES = 380_000

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Shrinks a picture before it is uploaded: at most 1200 px on a side and about 380 KB, as WebP
 * (JPEG where the browser cannot write WebP). Throws when it cannot get small enough.
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.85, 0.7, 0.55]) {
        const webp = await toBlob(canvas, 'image/webp', quality)
        const blob = webp?.type === 'image/webp' ? webp : await toBlob(canvas, 'image/jpeg', quality)
        if (blob && blob.size <= MAX_BYTES) return blob
      }
      scale *= 0.75
    }
  } finally {
    bitmap.close()
  }
  throw new Error('image too large')
}
