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
