import { AiImageError, generateLifeForceImage } from "../lib/ai-image-server";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): unknown;
  end(): unknown;
};

const allowedOrigins = new Set([
  "https://louyuhong807-dotcom.github.io",
  "https://life-force-portrait-lab.vercel.app",
]);

function setCors(request: VercelRequest, response: VercelResponse) {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : "";
  const isProjectPreview = origin.startsWith("https://life-force-portrait-lab-") && origin.endsWith(".vercel.app");
  if (allowedOrigins.has(origin) || isProjectPreview) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  setCors(request, response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method === "GET") {
    return response.status(200).json({
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: "gpt-image-2",
      mode: "text-to-image",
    });
  }
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return response.status(503).json({ error: "AI 生图服务尚未配置", code: "not_configured" });

  try {
    return response.status(200).json(await generateLifeForceImage(request.body ?? {}, apiKey));
  } catch (error) {
    if (error instanceof AiImageError) return response.status(error.status).json({ error: error.message, code: error.code });
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return response.status(504).json({ error: "生成时间较长，请稍后重试", code: "timeout" });
    }
    return response.status(500).json({ error: "AI 生图暂时不可用", code: "unknown" });
  }
}
