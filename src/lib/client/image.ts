type CompressionOptions = {
  maxDimension?: number;
  maxDataUrlLength?: number;
  initialQuality?: number;
  minQuality?: number;
};

const DEFAULTS: Required<CompressionOptions> = {
  maxDimension: 1280,
  maxDataUrlLength: 2_000_000,
  initialQuality: 0.86,
  minQuality: 0.55,
};

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode image"));
    image.src = url;
  });
}

function normalizedSize(width: number, height: number, maxDimension: number) {
  const maxSide = Math.max(width, height);
  if (maxSide <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / maxSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function prepareImageForAnalysis(file: File, options?: CompressionOptions) {
  const config = { ...DEFAULTS, ...options };
  if (!file.type.startsWith("image/")) {
    throw new Error("Unsupported file type");
  }

  // Fast path for already-small files.
  if (file.size <= 600 * 1024) {
    return readAsDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromUrl(objectUrl);
    const { width, height } = normalizedSize(image.naturalWidth, image.naturalHeight, config.maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return readAsDataUrl(file);
    }

    context.drawImage(image, 0, 0, width, height);

    let quality = config.initialQuality;
    let output = canvas.toDataURL("image/jpeg", quality);

    while (output.length > config.maxDataUrlLength && quality > config.minQuality) {
      quality = Math.max(config.minQuality, quality - 0.08);
      output = canvas.toDataURL("image/jpeg", quality);
    }

    return output;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function fileFromDataUrl(dataUrl: string, fileName = `meal-${Date.now()}.jpg`) {
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid image data");
  }

  const mimeType = matches[1];
  const base64 = matches[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
}
