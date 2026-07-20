import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const steps = [
  ["类型检查", ["run", "typecheck"]],
  ["代码检查", ["run", "lint"]],
  ["应用构建与测试", ["test"]],
  ["手机发布构建", ["run", "build:pages:single"]],
  ["发布包健康检查", ["run", "healthcheck"]],
];

const startedAt = new Date().toISOString();
const results = [];

for (const [name, args] of steps) {
  console.log(`\n[巡航] ${name}`);
  const started = Date.now();
  const result = spawnSync("pnpm", args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  results.push({
    name,
    ok: result.status === 0,
    exitCode: result.status,
    durationMs: Date.now() - started,
    output: `${stdout}\n${stderr}`.slice(-16_000),
  });
}

await mkdir(".cruise", { recursive: true });
await writeFile(".cruise/report.json", JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), results }, null, 2));

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\n巡航发现 ${failed.length} 项问题：${failed.map((item) => item.name).join("、")}`);
  process.exit(1);
}

console.log("\n巡航全部通过");
