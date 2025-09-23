import ImageKit from 'imagekit';

function extractImageKitIdFromUrl(url) {
  try {
    const u = new URL(url);
    // path may be like '/<imagekit_id>/' or '/<imagekit_id>/folder/'
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.length > 0 ? parts[0] : null;
  } catch (err) {
    return null;
  }
}

function createImageKit() {
  const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;
  if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
    return null;
  }

  const imageKitId = extractImageKitIdFromUrl(IMAGEKIT_URL_ENDPOINT);

  try {
    // pass both common variants to be defensive against SDK checks
    const opts = {
      publicKey: IMAGEKIT_PUBLIC_KEY,
      privateKey: IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    };
    if (imageKitId) {
      opts.imageKitId = imageKitId;
      opts.imagekitId = imageKitId;
    }

    return new ImageKit(opts);
  } catch (err) {
    console.error('ImageKit initialization failed:', err && err.message ? err.message : err);
    return null;
  }
}

const imageKitInstance = createImageKit();

export function getImageKitInstance() {
  return imageKitInstance;
}

export async function uploadToImageKit({ file, fileName, useUniqueFileName = true }) {
  const ik = getImageKitInstance();
  if (!ik) return null;

  let payload = file;
  if (Buffer.isBuffer(file)) payload = file.toString('base64');

  try {
    const result = await ik.upload({
      file: payload,
      fileName: fileName || `upload_${Date.now()}`,
      useUniqueFileName,
    });
    return result;
  } catch (err) {
    console.error('ImageKit upload failed:', err && err.message ? err.message : err);
    throw err;
  }
}
