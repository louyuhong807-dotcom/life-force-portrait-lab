# 小粥的修图神器

一个基于 Fantasy 生命感人像摄影 Skill 的开源手机人像工具。普通照片在浏览器本地完成光线、综合色彩、肤色保护与镜头质感调整；AI 原创样片通过可选的服务端 GPT Image 接口生成。

## 产品边界

- 普通调色、预设、导出与分享图默认只在设备本地处理，不上传原图。
- 只有用户主动点击“AI 去除背景杂物”时，网页才会把一张压缩副本发送给服务端 AI；原图不会被覆盖。
- 保留人物身份、五官、表情、动作、服装与体型。
- 皮肤保持柔润哑光与真实纹理，避免油光、塑料感和重滤镜。
- AI 生图只生成原创人物，不复刻明星、真人或参考图。
- API Key 只允许存放在服务端 Secret，不得写进网页、提交记录或公开仓库。

## 已有功能

- 上传、拖入与示例照片
- 自动分析亮度和色彩，推荐生命感配方
- 阳光生命力、电影侧光、泳池焦散、咖啡馆氛围、清透日常
- 光线、色彩、肤色守护、镜头质感分层调整
- 原图/成片拖动对比
- 原尺寸高清导出与微信分享引导
- GPT Image 2 原创生命感样片，可回送修图台
- GPT Image 2 一键清理背景杂物，严格锁定人物身份与主体细节
- 手机滑杆大触控区与轻量预览，高清导出仍保留原分辨率
- 页面运行时自动恢复
- GitHub Actions 每日巡航、确定性修复、可选 AI 小范围修复

## 本地运行

需要 Node.js 22 与 pnpm。

```bash
pnpm install
pnpm dev
```

本地启用 AI 生图时，新建 `.env.local`，只在本机填写：

```text
OPENAI_API_KEY=你的服务端密钥
```

不要提交 `.env.local`。

## 自动巡航

```bash
pnpm run cruise
```

巡航会依次完成：

1. TypeScript 类型检查
2. ESLint 代码检查
3. 应用构建与回归测试
4. 手机单页发布构建
5. 发布包体积、关键文案、旧链接与移动端入口检查

GitHub 上的 `AI 自动巡航` 每天运行一次，也会在提交和 PR 时运行。确定性修复会先处理可安全自动修复的问题；如果仓库 Secret 中配置了 `OPENAI_API_KEY`，失败日志才会交给 `gpt-5.6-terra` 生成小范围、可审核的搜索替换补丁。任何 AI 修复都必须重新通过整套巡航，且只创建 PR，不直接改主分支。

## 部署

- GitHub Pages：执行 `pnpm run build:pages:single`，产物在 `dist-pages-single/`。
- Sites：执行主构建并按 `.openai/hosting.json` 发布。
- Vercel：`vercel.json` 会发布手机网页与 `/api/generate` 服务端接口；在项目环境变量中添加 `OPENAI_API_KEY` 后 AI 生图才会启用。

公开网页：[生命感人像修图神器](https://louyuhong807-dotcom.github.io/life-force-portrait-lab/)

原始摄影工作流：[Fantasy 生命感人像摄影 Skill](https://github.com/dacnay816y62-hub/fantasy-life-force-portrait-photography)
