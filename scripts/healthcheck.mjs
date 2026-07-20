import { access, readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const pageUrl = new URL("dist-pages-single/index.html", root);
const ogUrl = new URL("dist-pages-single/og.jpg", root);

await access(pageUrl);
await access(ogUrl);

const [html, pageStat, ogStat] = await Promise.all([
  readFile(pageUrl, "utf8"),
  stat(pageUrl),
  stat(ogUrl),
]);

const required = ["小粥的修图神器", "AI 原创样片", "AI 一键", "自动巡航", "全程本地处理"];
for (const marker of required) {
  if (!html.includes(marker)) throw new Error(`发布文件缺少关键内容：${marker}`);
}
if (html.includes("dacnay816y62-hub.github.io")) throw new Error("分享图仍指向旧仓库");
if (html.includes("localhost:")) throw new Error("发布文件包含本地地址");
if (pageStat.size > 1_500_000) throw new Error(`单页体积过大：${pageStat.size} bytes`);
if (ogStat.size < 10_000) throw new Error("分享图文件异常");

const publicUrl = process.env.PUBLIC_SITE_URL;
if (publicUrl) {
  const agents = {
    desktop: "Mozilla/5.0 Chrome/126 Safari/537.36",
    mobile: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1",
    wechat: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 MicroMessenger/8.0.56",
  };
  for (const [name, userAgent] of Object.entries(agents)) {
    const response = await fetch(publicUrl, {
      headers: { Range: "bytes=0-131071", "User-Agent": userAgent },
      signal: AbortSignal.timeout(30_000),
    });
    if (![200, 206].includes(response.status)) throw new Error(`${name} 访问失败：HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    if (!contentType.includes("text/html") || !/<(?:!doctype\s+html|html)[\s>]/i.test(body)) {
      throw new Error(`${name} 返回的不是网页`);
    }
  }
}

console.log(`巡航通过：页面 ${pageStat.size} bytes，分享图 ${ogStat.size} bytes`);
