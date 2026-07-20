import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render(pathname = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`https://life-force.example${pathname}`, {
      headers: { accept: "text/html", host: "life-force.example" },
      ...init,
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the finished life-force editor", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /小粥的修图神器/);
  assert.match(html, /把普通照片/);
  assert.match(html, /生命感配方/);
  assert.match(html, /本地处理/);
  assert.match(html, /分享成片到微信/);
  assert.match(html, /AI 原创样片/);
  assert.match(html, /去除背景杂物/);
  assert.match(html, /AI 自动巡航/);
  assert.match(html, /https:\/\/life-force\.example\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("ships local image processing and branded assets", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../dist/client/og.png", import.meta.url)),
    access(new URL("../dist/client/demo/rooftop-before.jpg", import.meta.url)),
  ]);

  assert.match(page, /function processPixels/);
  assert.match(page, /skinGuard/);
  assert.match(page, /canvas\.toBlob/);
  assert.match(page, /navigator\.share/);
  assert.match(page, /navigator\.canShare/);
  assert.match(page, /MicroMessenger/);
  assert.match(page, /全程本地处理/);
  assert.match(page, /generateAiPortrait/);
  assert.match(page, /cleanupBackground/);
  assert.match(page, /gpt-image-2|AI 生成生命感样片/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /summary_large_image/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  await access(new URL("public/favicon.svg", root));
});

test("AI image route fails safely before a server secret is configured", async () => {
  const response = await render("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json", host: "life-force.example" },
    body: JSON.stringify({ description: "夏日屋顶上被风吹乱头发的原创中国人物", style: "sunlight" }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "AI 生图服务尚未配置", code: "not_configured" });
});

test("AI cleanup route fails safely before a server secret is configured", async () => {
  const response = await render("/api/cleanup", {
    method: "POST",
    headers: { "content-type": "application/json", host: "life-force.example" },
    body: JSON.stringify({ imageDataUrl: "data:image/jpeg;base64,AA==", orientation: "portrait" }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "AI 清理服务尚未配置", code: "not_configured" });
});
