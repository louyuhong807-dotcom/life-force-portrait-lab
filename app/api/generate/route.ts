import { AiImageError, generateLifeForceImage } from "@/lib/ai-image-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return json({
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: "gpt-image-2",
    mode: "text-to-image",
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: "AI 生图服务尚未配置", code: "not_configured" }, 503);

  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 8_192) return json({ error: "请求内容过大", code: "payload_too_large" }, 413);
    const input = await request.json();
    return json(await generateLifeForceImage(input, apiKey));
  } catch (error) {
    if (error instanceof AiImageError) return json({ error: error.message, code: error.code }, error.status);
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return json({ error: "生成时间较长，请稍后重试", code: "timeout" }, 504);
    }
    return json({ error: "AI 生图暂时不可用", code: "unknown" }, 500);
  }
}
