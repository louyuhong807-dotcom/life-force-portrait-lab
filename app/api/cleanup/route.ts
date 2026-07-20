import { AiImageError, cleanupPortraitBackground } from "@/lib/ai-image-server";

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
    mode: "background-cleanup",
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: "AI 清理服务尚未配置", code: "not_configured" }, 503);

  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 5_800_000) return json({ error: "图片过大", code: "payload_too_large" }, 413);
    const input = await request.json();
    return json(await cleanupPortraitBackground(input, apiKey));
  } catch (error) {
    if (error instanceof AiImageError) return json({ error: error.message, code: error.code }, error.status);
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return json({ error: "清理时间较长，请稍后重试", code: "timeout" }, 504);
    }
    return json({ error: "AI 清理暂时不可用", code: "unknown" }, 500);
  }
}
