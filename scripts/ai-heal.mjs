import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const apiKey = process.env.OPENAI_API_KEY;
const logPath = process.argv[2] ?? ".cruise/report.json";
if (!apiKey) {
  console.log("未配置 OPENAI_API_KEY，跳过 AI 修复");
  process.exit(0);
}

const allowed = /^(app|api|github-pages|lib|scripts|tests|worker)\/[\w./-]+$|^(package\.json|tsconfig\.json|eslint\.config\.mjs|vite\.config\.ts|vite\.github\.config\.ts|vercel\.json)$/;
const log = (await readFile(logPath, "utf8")).slice(-24_000);
const candidatePaths = [...new Set(log.match(/[\w./-]+\.(?:ts|tsx|mjs|json|css|html)/g) ?? [])]
  .filter((file) => allowed.test(file) && !file.includes("dist"))
  .slice(0, 8);
const fallbackPaths = ["app/page.tsx", "app/globals.css", "package.json", "tsconfig.json"];
const contextPaths = [...new Set([...candidatePaths, ...fallbackPaths])].slice(0, 10);
const files = [];
for (const file of contextPaths) {
  try {
    files.push(`FILE: ${file}\n${(await readFile(file, "utf8")).slice(0, 14_000)}`);
  } catch {
    // The log may mention generated or deleted files; ignore them.
  }
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    patches: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string" },
          search: { type: "string" },
          replace: { type: "string" },
          reason: { type: "string" },
        },
        required: ["path", "search", "replace", "reason"],
      },
    },
  },
  required: ["summary", "patches"],
};

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gpt-5.6-terra",
    store: false,
    reasoning: { effort: "low" },
    max_output_tokens: 4_000,
    instructions: "Repair only the reported failure with the smallest safe source edit. Never modify workflows, secrets, lockfiles, generated files, auth, permissions, or dependencies. Return exact single-match search/replace patches. If evidence is insufficient, return no patches.",
    input: `CRUISE FAILURE\n${log}\n\nSOURCE CONTEXT\n${files.join("\n\n")}`,
    text: { format: { type: "json_schema", name: "safe_repair", strict: true, schema } },
  }),
  signal: AbortSignal.timeout(120_000),
});

if (!response.ok) throw new Error(`AI repair request failed: HTTP ${response.status}`);
const payload = await response.json();
const outputText = payload.output
  ?.flatMap((item) => item.content ?? [])
  .find((item) => item.type === "output_text")?.text;
if (!outputText) throw new Error("AI repair returned no structured output");
const plan = JSON.parse(outputText);

let changed = 0;
for (const patch of plan.patches) {
  if (!allowed.test(patch.path) || patch.path.startsWith(".github/") || patch.path.includes("dist")) continue;
  if (!patch.search || patch.search.length > 20_000 || patch.replace.length > 20_000) continue;
  const target = path.resolve(patch.path);
  if (!target.startsWith(`${process.cwd()}${path.sep}`)) continue;
  const source = await readFile(target, "utf8");
  const first = source.indexOf(patch.search);
  if (first < 0 || first !== source.lastIndexOf(patch.search)) continue;
  await writeFile(target, source.replace(patch.search, patch.replace));
  changed += 1;
  console.log(`已应用安全修复：${patch.path} — ${patch.reason}`);
}

console.log(`${plan.summary}\n应用 ${changed} 个修复`);
