import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve("dist-pages");
const targetDir = path.resolve("dist-pages-single");
const assetsDir = path.join(sourceDir, "assets");
const assetNames = await readdir(assetsDir);
const jsName = assetNames.find((name) => name.endsWith(".js"));
const cssName = assetNames.find((name) => name.endsWith(".css"));

if (!jsName || !cssName) throw new Error("GitHub Pages assets are missing");

let html = await readFile(path.join(sourceDir, "index.html"), "utf8");
let script = await readFile(path.join(assetsDir, jsName), "utf8");
const styles = await readFile(path.join(assetsDir, cssName), "utf8");
const demoDir = path.join(sourceDir, "demo");

for (const name of await readdir(demoDir)) {
  const image = await readFile(path.join(demoDir, name));
  script = script.replaceAll(`demo/${name}`, `data:image/jpeg;base64,${image.toString("base64")}`);
}

const logo = await readFile(path.join(sourceDir, "xiaozhou-logo.jpg"));
script = script.replaceAll("xiaozhou-logo.jpg", `data:image/jpeg;base64,${logo.toString("base64")}`);

html = html
  .replace(
    /\s*<script type="module" crossorigin src="[^"]+"><\/script>/,
    () => `\n    <script type="module">${script.replaceAll("</script>", "<\\/script>")}</script>`,
  )
  .replace(
    /\s*<link rel="stylesheet" crossorigin href="[^"]+">/,
    () => `\n    <style>${styles}</style>`,
  );

await mkdir(targetDir, { recursive: true });
await writeFile(path.join(targetDir, "index.html"), html);
await writeFile(path.join(targetDir, "og.jpg"), await readFile(path.join(sourceDir, "og.jpg")));

console.log(path.join(targetDir, "index.html"));
