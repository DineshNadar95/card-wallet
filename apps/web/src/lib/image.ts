const MAX_SIDE = 2000;

/**
 * Re-encode a photo as JPEG, at most 2000px on the long side, before upload.
 * Keeps uploads well under the API's 5 MB image limit and drops EXIF metadata
 * (including GPS location) so it never leaves the device.
 */
export async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This browser can't open that image. Try a JPEG or PNG screenshot.");
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process the image"))), "image/jpeg", 0.85),
  );
}
