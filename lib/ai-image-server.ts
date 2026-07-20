import { buildLifeForcePrompt, imageStyles, type ImageStyleId } from "./life-force-prompt";

type GenerateInput = {
  description?: unknown;
  style?: unknown;
  quality?: unknown;
};

type OpenAIImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { code?: string; message?: string };
};

type CleanupInput = {
  imageDataUrl?: unknown;
  orientation?: unknown;
};

export class AiImageError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function generateLifeForceImage(input: GenerateInput, apiKey: string) {
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const requestedStyle = typeof input.style === "string" ? input.style : "sunlight";
  const style = requestedStyle in imageStyles ? (requestedStyle as ImageStyleId) : "sunlight";
  const quality = input.quality === "medium" ? "medium" : "low";

  if (description.length < 4) {
    throw new AiImageError(400, "description_required", "请先描述人物、动作和场景");
  }
  if (description.length > 600) {
    throw new AiImageError(400, "description_too_long", "描述请控制在 600 字以内");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: buildLifeForcePrompt(description, style),
      n: 1,
      size: "1024x1360",
      quality,
      output_format: "jpeg",
      output_compression: 82,
      moderation: "auto",
    }),
    signal: AbortSignal.timeout(115_000),
  });

  const result = (await response.json().catch(() => ({}))) as OpenAIImageResponse;
  if (!response.ok) {
    const code = result.error?.code ?? `openai_${response.status}`;
    const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 400;
    const message = code === "moderation_blocked"
      ? "这个描述未通过安全检查，请换一种中性表达"
      : response.status === 429
        ? "生成请求较多，请稍后再试"
        : response.status >= 500
          ? "AI 生图服务暂时繁忙，请稍后重试"
          : "AI 生图请求未完成，请检查描述后重试";
    throw new AiImageError(status, code, message);
  }

  const image = result.data?.[0]?.b64_json;
  if (!image) throw new AiImageError(502, "missing_image", "AI 未返回图片，请重试");

  return {
    imageDataUrl: `data:image/jpeg;base64,${image}`,
    style,
    quality,
  };
}

function decodeImageDataUrl(value: unknown) {
  if (typeof value !== "string") {
    throw new AiImageError(400, "image_required", "请先上传一张人像照片");
  }

  const match = value.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new AiImageError(400, "invalid_image", "图片格式不受支持，请换一张试试");
  if (match[2].length > 5_200_000) throw new AiImageError(413, "image_too_large", "图片太大，请压缩后重试");

  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: match[1] === "jpg" ? "image/jpeg" : `image/${match[1]}` });
  } catch {
    throw new AiImageError(400, "invalid_image", "图片读取失败，请重新上传");
  }
}

export async function cleanupPortraitBackground(input: CleanupInput, apiKey: string) {
  const image = decodeImageDataUrl(input.imageDataUrl);
  const orientation = input.orientation === "landscape" || input.orientation === "square" ? input.orientation : "portrait";
  const size = orientation === "landscape" ? "1536x1024" : orientation === "square" ? "1024x1024" : "1024x1536";
  const prompt = [
    "Edit only the distracting clutter in the background of this real portrait photo.",
    "Remove accidental background distractions such as unrelated passersby, litter, loose cables, intrusive signs, random bags, parked clutter, and small objects that pull attention away from the person.",
    "Reconstruct every removed area from the surrounding real background so the result remains a natural photograph of the same place.",
    "STRICT IDENTITY LOCK: keep the exact same person, face, facial geometry, expression, gaze, age, skin texture, hairline, hairstyle, body, pose, hands, clothing, accessories, and main props.",
    "Keep the exact camera angle, crop, composition, lighting direction, shadows, colors, depth of field, perspective, scene type, and moment.",
    "Do not beautify, retouch skin, change body shape, relight, recolor, restyle, replace the whole background, add objects, add text, or blur the entire background.",
    "The output must look like the original photo after a careful photographer quietly removed only background distractions.",
  ].join(" ");

  const body = new FormData();
  body.append("model", "gpt-image-2");
  body.append("image[]", image, "portrait.jpg");
  body.append("prompt", prompt);
  body.append("size", size);
  body.append("quality", "low");
  body.append("output_format", "jpeg");
  body.append("output_compression", "84");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    signal: AbortSignal.timeout(115_000),
  });

  const result = (await response.json().catch(() => ({}))) as OpenAIImageResponse;
  if (!response.ok) {
    const code = result.error?.code ?? `openai_${response.status}`;
    const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 400;
    const message = code === "moderation_blocked"
      ? "这张照片未通过安全检查，请换一张照片"
      : response.status === 429
        ? "清理请求较多，请稍后再试"
        : response.status >= 500
          ? "AI 清理服务暂时繁忙，请稍后重试"
          : "AI 未能完成背景清理，请换一张照片重试";
    throw new AiImageError(status, code, message);
  }

  const edited = result.data?.[0]?.b64_json;
  if (!edited) throw new AiImageError(502, "missing_image", "AI 未返回清理结果，请重试");

  return {
    imageDataUrl: `data:image/jpeg;base64,${edited}`,
    mode: "background-cleanup",
  };
}
