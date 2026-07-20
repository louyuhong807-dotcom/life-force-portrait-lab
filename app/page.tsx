"use client";

import {
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Adjustments = {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  warmth: number;
  tint: number;
  bloom: number;
  fade: number;
  vignette: number;
  grain: number;
  aberration: number;
  skinGuard: number;
};

type Analysis = {
  brightness: number;
  saturation: number;
  summary: string;
  light: string;
  color: string;
};

type PreviewSize = { width: number; height: number; sourceWidth: number; sourceHeight: number };

type Preset = {
  id: string;
  name: string;
  note: string;
  color: string;
  values: Adjustments;
};

const neutral: Adjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  warmth: 0,
  tint: 0,
  bloom: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
  aberration: 0,
  skinGuard: 72,
};

const presets: Preset[] = [
  {
    id: "alive",
    name: "阳光生命力",
    note: "通透硬光 · 晒透的颜色",
    color: "#ff5b36",
    values: {
      exposure: 13,
      contrast: 17,
      highlights: -16,
      shadows: 20,
      saturation: 24,
      warmth: 10,
      tint: 2,
      bloom: 13,
      fade: 2,
      vignette: 5,
      grain: 3,
      aberration: 7,
      skinGuard: 78,
    },
  },
  {
    id: "cinema",
    name: "电影侧光",
    note: "拉开景深 · 克制暖调",
    color: "#2c59db",
    values: {
      exposure: 4,
      contrast: 25,
      highlights: -24,
      shadows: 10,
      saturation: 13,
      warmth: 8,
      tint: -3,
      bloom: 8,
      fade: 6,
      vignette: 18,
      grain: 7,
      aberration: 5,
      skinGuard: 82,
    },
  },
  {
    id: "pool",
    name: "泳池焦散",
    note: "清亮蓝调 · 水光边缘",
    color: "#20b9c5",
    values: {
      exposure: 16,
      contrast: 14,
      highlights: -21,
      shadows: 17,
      saturation: 29,
      warmth: -8,
      tint: -5,
      bloom: 18,
      fade: 1,
      vignette: 3,
      grain: 2,
      aberration: 15,
      skinGuard: 86,
    },
  },
  {
    id: "cafe",
    name: "咖啡馆氛围",
    note: "暖色记忆 · 柔和暗部",
    color: "#b86b35",
    values: {
      exposure: 7,
      contrast: 12,
      highlights: -29,
      shadows: 24,
      saturation: 15,
      warmth: 17,
      tint: 4,
      bloom: 11,
      fade: 8,
      vignette: 13,
      grain: 6,
      aberration: 3,
      skinGuard: 84,
    },
  },
  {
    id: "clean",
    name: "清透日常",
    note: "自然提亮 · 真实肤色",
    color: "#78a642",
    values: {
      exposure: 9,
      contrast: 7,
      highlights: -12,
      shadows: 15,
      saturation: 9,
      warmth: 4,
      tint: 0,
      bloom: 5,
      fade: 1,
      vignette: 2,
      grain: 1,
      aberration: 0,
      skinGuard: 90,
    },
  },
];

const controlGroups: Array<{
  title: string;
  eyebrow: string;
  fields: Array<{ key: keyof Adjustments; label: string; min: number; max: number }>;
}> = [
  {
    title: "先有光",
    eyebrow: "01 / 光线",
    fields: [
      { key: "exposure", label: "曝光", min: -60, max: 60 },
      { key: "contrast", label: "对比", min: -60, max: 60 },
      { key: "highlights", label: "高光", min: -60, max: 60 },
      { key: "shadows", label: "阴影", min: -60, max: 60 },
    ],
  },
  {
    title: "再做综合色彩",
    eyebrow: "02 / 色彩",
    fields: [
      { key: "saturation", label: "鲜活度", min: -60, max: 60 },
      { key: "warmth", label: "色温", min: -50, max: 50 },
      { key: "tint", label: "色调", min: -50, max: 50 },
      { key: "skinGuard", label: "肤色守护", min: 0, max: 100 },
    ],
  },
  {
    title: "最后加质感",
    eyebrow: "03 / 镜头",
    fields: [
      { key: "bloom", label: "高光溢出", min: 0, max: 40 },
      { key: "fade", label: "空气感", min: 0, max: 35 },
      { key: "vignette", label: "聚焦", min: 0, max: 50 },
      { key: "grain", label: "胶片颗粒", min: 0, max: 30 },
      { key: "aberration", label: "边缘色散", min: 0, max: 30 },
    ],
  },
];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function isSkin(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return r > 0.28 && g > 0.16 && b > 0.1 && r > g * 1.03 && r > b * 1.12 && max - min > 0.08;
}

function processPixels(source: ImageData, settings: Adjustments) {
  const input = source.data;
  const output = new Uint8ClampedArray(input.length);
  const width = source.width;
  const height = source.height;
  const exposure = Math.pow(2, settings.exposure / 100);
  const contrast = 1 + settings.contrast / 100;
  const saturation = 1 + settings.saturation / 100;
  const fade = settings.fade / 100;
  const skinGuard = settings.skinGuard / 100;
  let seed = 9347;

  for (let i = 0; i < input.length; i += 4) {
    let r = input[i] / 255;
    let g = input[i + 1] / 255;
    let b = input[i + 2] / 255;
    const skin = isSkin(r, g, b);
    const protection = skin ? 1 - skinGuard * 0.68 : 1;

    r *= exposure;
    g *= exposure;
    b *= exposure;

    let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const shadowMask = clamp((0.62 - luminance) / 0.62);
    const highlightMask = clamp((luminance - 0.38) / 0.62);
    const shadowLift = (settings.shadows / 100) * shadowMask * 0.32;
    const highlightShift = (settings.highlights / 100) * highlightMask * 0.28;
    r += shadowLift + highlightShift;
    g += shadowLift + highlightShift;
    b += shadowLift + highlightShift;

    const localContrast = 1 + (contrast - 1) * protection;
    r = (r - 0.5) * localContrast + 0.5;
    g = (g - 0.5) * localContrast + 0.5;
    b = (b - 0.5) * localContrast + 0.5;

    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const localSaturation = 1 + (saturation - 1) * protection;
    r = luminance + (r - luminance) * localSaturation;
    g = luminance + (g - luminance) * localSaturation;
    b = luminance + (b - luminance) * localSaturation;

    const warmth = (settings.warmth / 100) * 0.18 * protection;
    const tint = (settings.tint / 100) * 0.12 * protection;
    r += warmth + tint * 0.45;
    g -= tint * 0.34;
    b -= warmth + tint * 0.14;

    r = r * (1 - fade * 0.28) + fade * 0.14;
    g = g * (1 - fade * 0.28) + fade * 0.14;
    b = b * (1 - fade * 0.28) + fade * 0.15;

    const pixel = i / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const dx = x / width - 0.5;
    const dy = y / height - 0.5;
    const distance = clamp((Math.sqrt(dx * dx + dy * dy) - 0.18) / 0.55);
    const vignette = 1 - distance * (settings.vignette / 100) * 0.52;
    r *= vignette;
    g *= vignette;
    b *= vignette;

    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = ((seed / 4294967296) - 0.5) * (settings.grain / 100) * 0.18;
    r += noise;
    g += noise;
    b += noise;

    if (skin) {
      const skinLuma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (skinLuma > 0.76) {
        const compression = (skinLuma - 0.76) * skinGuard * 0.55;
        r -= compression;
        g -= compression;
        b -= compression;
      }
    }

    output[i] = clamp(r) * 255;
    output[i + 1] = clamp(g) * 255;
    output[i + 2] = clamp(b) * 255;
    output[i + 3] = input[i + 3];
  }

  if (settings.aberration > 0) {
    const base = new Uint8ClampedArray(output);
    const maxShift = Math.max(1, Math.round(settings.aberration / 8));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const nx = x / width - 0.5;
        const ny = y / height - 0.5;
        const edge = clamp((Math.sqrt(nx * nx + ny * ny) - 0.28) / 0.42);
        if (edge <= 0) continue;
        const shift = Math.max(1, Math.round(maxShift * edge));
        const target = (y * width + x) * 4;
        const redSource = (y * width + clamp(x + shift, 0, width - 1)) * 4;
        const blueSource = (y * width + clamp(x - shift, 0, width - 1)) * 4;
        output[target] = base[redSource];
        output[target + 2] = base[blueSource + 2];
      }
    }
  }

  return new ImageData(output, width, height);
}

function drawProcessed(canvas: HTMLCanvasElement, source: ImageData, settings: Adjustments) {
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;
  const processed = processPixels(source, settings);
  context.putImageData(processed, 0, 0);

  if (settings.bloom > 0) {
    const glow = document.createElement("canvas");
    glow.width = source.width;
    glow.height = source.height;
    const glowContext = glow.getContext("2d");
    if (glowContext) {
      glowContext.putImageData(processed, 0, 0);
      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = (settings.bloom / 100) * 0.42;
      context.filter = `blur(${Math.max(2, Math.round(source.width / 260))}px) brightness(1.08)`;
      context.drawImage(glow, 0, 0);
      context.restore();
    }
  }
}

function analyzeImage(data: ImageData): Analysis {
  let brightness = 0;
  let saturation = 0;
  let samples = 0;
  const step = Math.max(4, Math.floor(data.data.length / 16000 / 4) * 4);
  for (let i = 0; i < data.data.length; i += step) {
    const r = data.data[i] / 255;
    const g = data.data[i + 1] / 255;
    const b = data.data[i + 2] / 255;
    brightness += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    saturation += Math.max(r, g, b) - Math.min(r, g, b);
    samples += 1;
  }
  brightness /= samples;
  saturation /= samples;

  const light = brightness < 0.35 ? "画面偏暗，建议打开人物阴影" : brightness > 0.7 ? "高光充足，注意保留皮肤层次" : "光线均衡，可以强化方向感";
  const color = saturation < 0.2 ? "色彩偏平，适合建立一组主色" : saturation > 0.48 ? "综合色彩已经鲜明，宜克制加色" : "色彩有基础，可适度提纯";
  const summary = brightness < 0.38 ? "先提人物，再压高光" : saturation < 0.23 ? "先定主色，再加镜头质感" : "人物状态已成立，做轻量摄影增强";
  return { brightness, saturation, summary, light, color };
}

function makeSmartSettings(analysis: Analysis) {
  const base = presets[0].values;
  return {
    ...base,
    exposure: analysis.brightness < 0.36 ? 18 : analysis.brightness > 0.68 ? 2 : 10,
    shadows: analysis.brightness < 0.4 ? 28 : 16,
    highlights: analysis.brightness > 0.62 ? -30 : -15,
    saturation: analysis.saturation < 0.2 ? 28 : analysis.saturation > 0.5 ? 7 : 18,
    skinGuard: analysis.brightness > 0.62 ? 90 : 82,
  };
}

export default function Home() {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const sourceDataRef = useRef<ImageData | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const editedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const [settings, setSettings] = useState<Adjustments>(presets[0].values);
  const [activePreset, setActivePreset] = useState("alive");
  const [previewSize, setPreviewSize] = useState<PreviewSize>({ width: 1086, height: 1448, sourceWidth: 1086, sourceHeight: 1448 });
  const [compare, setCompare] = useState(48);
  const [fileName, setFileName] = useState("示例 · 天台随拍.jpg");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePreviewUrl, setSharePreviewUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [activeGroup, setActiveGroup] = useState(0);

  const loadImage = useCallback((url: string, name: string, isDemo = false) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      imageRef.current = image;
      const maxPreviewEdge = 1500;
      const ratio = Math.min(1, maxPreviewEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * ratio));
      const height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = width;
      sourceCanvas.height = height;
      const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, width, height);
      const source = context.getImageData(0, 0, width, height);
      sourceDataRef.current = source;
      setPreviewSize({ width, height, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight });
      setFileName(name);
      setCompare(48);
      const result = analyzeImage(source);
      setAnalysis(result);
      const smart = isDemo ? presets[0].values : makeSmartSettings(result);
      setSettings(smart);
      setActivePreset(isDemo ? "alive" : "smart");
      setNotice(isDemo ? "" : "已按 Skill 完成初步判断，可继续微调");
    };
    image.onerror = () => setNotice("这张图片暂时无法读取，请换一张试试");
    image.src = url;
  }, []);

  useEffect(() => {
    loadImage("/demo/rooftop-before.jpg", "示例 · 天台随拍.jpg", true);
    return () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    };
  }, [loadImage]);

  useEffect(() => () => {
    if (sharePreviewUrl) URL.revokeObjectURL(sharePreviewUrl);
  }, [sharePreviewUrl]);

  useEffect(() => {
    if (!sourceDataRef.current || !originalCanvasRef.current || !editedCanvasRef.current) return;
    if (renderFrameRef.current) cancelAnimationFrame(renderFrameRef.current);
    renderFrameRef.current = requestAnimationFrame(() => {
      const source = sourceDataRef.current;
      if (!source || !originalCanvasRef.current || !editedCanvasRef.current) return;
      originalCanvasRef.current.width = source.width;
      originalCanvasRef.current.height = source.height;
      originalCanvasRef.current.getContext("2d", { alpha: false })?.putImageData(source, 0, 0);
      drawProcessed(editedCanvasRef.current, source, settings);
    });
    return () => {
      if (renderFrameRef.current) cancelAnimationFrame(renderFrameRef.current);
    };
  }, [settings, previewSize]);

  const handleFile = useCallback((file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("请选择 JPG、PNG 或 WebP 图片");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setNotice("图片请控制在 30MB 以内");
      return;
    }
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    const url = URL.createObjectURL(file);
    sourceUrlRef.current = url;
    loadImage(url, file.name);
  }, [loadImage]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const applyPreset = (preset: Preset) => {
    setSettings(preset.values);
    setActivePreset(preset.id);
    setNotice(`已应用「${preset.name}」`);
  };

  const updateSetting = (key: keyof Adjustments, value: number) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setActivePreset("");
  };

  const updateCompareFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setCompare(clamp(((event.clientX - rect.left) / rect.width) * 100, 2, 98));
  };

  const createProcessedBlob = async (maxEdge?: number, quality = 0.94) => {
    const image = imageRef.current;
    if (!image) throw new Error("image");
    const scale = maxEdge ? Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight)) : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!context) throw new Error("canvas");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    const source = context.getImageData(0, 0, width, height);
    drawProcessed(canvas, source, settings);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("blob");
    return blob;
  };

  const exportImage = async () => {
    if (!imageRef.current) return;
    setIsExporting(true);
    setNotice("正在生成高清图片…");
    await new Promise((resolve) => setTimeout(resolve, 20));
    try {
      const blob = await createProcessedBlob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stem = fileName.replace(/\.[^/.]+$/, "") || "portrait";
      link.href = href;
      link.download = `${stem}-生命感.jpg`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setNotice("高清成片已导出");
    } catch {
      setNotice("导出失败，请换一张尺寸更小的图片重试");
    } finally {
      setIsExporting(false);
    }
  };

  const openShareGuide = (blob: Blob) => {
    if (sharePreviewUrl) URL.revokeObjectURL(sharePreviewUrl);
    setSharePreviewUrl(URL.createObjectURL(blob));
    setShareOpen(true);
  };

  const shareToWeChat = async () => {
    if (!imageRef.current || isSharing) return;
    setIsSharing(true);
    setNotice("正在准备微信分享图…");
    await new Promise((resolve) => setTimeout(resolve, 20));
    try {
      const blob = await createProcessedBlob(2160, 0.9);
      const stem = fileName.replace(/\.[^/.]+$/, "") || "portrait";
      const file = new File([blob], `${stem}-生命感.jpg`, { type: "image/jpeg" });
      const fileShare: ShareData = {
        title: "生命感实验室",
        text: "把普通照片，重新看见。",
        files: [file],
      };
      const canShareFile = typeof navigator.canShare === "function" && navigator.canShare(fileShare);

      if (typeof navigator.share === "function" && canShareFile) {
        await navigator.share(fileShare);
        setNotice("已打开分享面板，选择微信即可");
      } else if (typeof navigator.share === "function" && !/MicroMessenger/i.test(navigator.userAgent)) {
        await navigator.share({
          title: "生命感实验室｜人像摄影修图神器",
          text: "把普通照片，重新看见。",
          url: window.location.href,
        });
        setNotice("已打开分享面板，选择微信即可");
      } else {
        openShareGuide(blob);
        setNotice("请按提示保存成片并分享到微信");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setNotice("已取消分享");
      } else {
        try {
          const blob = await createProcessedBlob(2160, 0.88);
          openShareGuide(blob);
          setNotice("请按提示保存成片并分享到微信");
        } catch {
          setNotice("分享图生成失败，请先保存高清成片");
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice("分享链接已复制");
    } catch {
      setNotice("请从浏览器地址栏复制链接");
    }
  };

  const closeShareGuide = () => {
    setShareOpen(false);
    if (sharePreviewUrl) {
      URL.revokeObjectURL(sharePreviewUrl);
      setSharePreviewUrl("");
    }
  };

  const recipe = useMemo(() => {
    const light = settings.exposure > 10 ? "提亮人物并打开暗部" : settings.contrast > 18 ? "强化光比与主体层次" : "保持自然光感";
    const color = settings.warmth > 10 ? "建立暖色记忆" : settings.warmth < -5 ? "建立清亮蓝调" : "保持自然暖肤色";
    const texture = settings.aberration > 10 ? "以边缘色散收尾" : settings.bloom > 10 ? "以高光溢出收尾" : "只做克制质感增强";
    return `${light}，${color}，${texture}。人物身份、表情和动作完全不变。`;
  }, [settings]);

  const examples = [
    { name: "天台侧光", before: "/demo/rooftop-before.jpg", after: "/demo/rooftop-after.jpg" },
    { name: "咖啡馆氛围", before: "/demo/cafe-before.jpg", after: "/demo/cafe-after.jpg" },
    { name: "书店电影感", before: "/demo/bookstore-before.jpg", after: "/demo/bookstore-after.jpg" },
  ];

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="生命感实验室首页">
          <span className="brand-mark">生</span>
          <span>
            <strong>生命感实验室</strong>
            <small>LIFE FORCE PORTRAIT</small>
          </span>
        </a>
        <div className="header-center">不换脸 · 不塑料 · 不堆滤镜</div>
        <div className="header-actions">
          <button className="share-top-button" type="button" onClick={shareToWeChat}>微信分享 <span aria-hidden="true">↗</span></button>
          <a className="github-link" href="https://github.com/dacnay816y62-hub/fantasy-life-force-portrait-photography" target="_blank" rel="noreferrer">
            Fantasy Skill <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <span className="kicker"><i /> Fantasy 生命感人像摄影 Skill 驱动</span>
          <h1>把普通照片，<br /><em>重新看见。</em></h1>
        </div>
        <div className="intro-copy">
          <p>生命感不是一种滤镜，而是人物、镜头和环境同时发生关系。</p>
          <span>上传照片，先由 Skill 判断光线与色彩，再用克制的摄影增强完成成片。</span>
        </div>
      </section>

      <section className="workspace" aria-label="生命感修图工作台">
        <div className="editor-panel">
          <div className="editor-toolbar">
            <div className="file-meta">
              <span className="status-dot" />
              <div>
                <strong>{fileName}</strong>
                <small>{previewSize.sourceWidth} × {previewSize.sourceHeight} · 本地处理</small>
              </div>
            </div>
            <div className="toolbar-actions">
              <button className="text-button" type="button" onClick={() => loadImage("/demo/rooftop-before.jpg", "示例 · 天台随拍.jpg", true)}>示例图</button>
              <button className="upload-button" type="button" onClick={() => fileInputRef.current?.click()}><span>＋</span> 换一张照片</button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} hidden />
            </div>
          </div>

          <div
            className={`image-stage ${isDragging ? "is-dragging" : ""}`}
            ref={stageRef}
            style={{ aspectRatio: `${previewSize.width} / ${previewSize.height}` }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              updateCompareFromPointer(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) updateCompareFromPointer(event);
            }}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            <canvas ref={editedCanvasRef} className="stage-canvas edited-canvas" />
            <div className="original-clip" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }}>
              <canvas ref={originalCanvasRef} className="stage-canvas" />
            </div>
            <span className="stage-label before-label">原图</span>
            <span className="stage-label after-label">生命感</span>
            <div className="compare-line" style={{ left: `${compare}%` }}>
              <span><b>‹</b><b>›</b></span>
            </div>
            {isDragging && <div className="drop-message">松开，开始重新看见这张照片</div>}
          </div>

          <div className="compare-control">
            <span>原图</span>
            <input aria-label="原图与成片对比" type="range" min="2" max="98" value={compare} onChange={(event) => setCompare(Number(event.target.value))} />
            <span>成片</span>
          </div>

          <div className="decision-card">
            <div className="decision-title">
              <span className="decision-icon">✦</span>
              <div><small>SKILL 判断</small><strong>{analysis?.summary ?? "正在读取画面"}</strong></div>
            </div>
            <div className="decision-notes">
              <span><i>光</i>{analysis?.light ?? "分析光线中"}</span>
              <span><i>色</i>{analysis?.color ?? "分析色彩中"}</span>
            </div>
            <p>{recipe}</p>
          </div>
        </div>

        <aside className="control-panel">
          <div className="control-heading">
            <div><span>生命感配方</span><h2>先摄影，后滤镜</h2></div>
            <button type="button" className="reset-button" onClick={() => { setSettings(neutral); setActivePreset(""); setNotice("已回到原图"); }}>全部重置</button>
          </div>

          <div className="preset-grid" aria-label="生命感预设">
            <button className={`preset-card smart-card ${activePreset === "smart" ? "active" : ""}`} type="button" onClick={() => analysis && (setSettings(makeSmartSettings(analysis)), setActivePreset("smart"), setNotice("已重新智能匹配"))}>
              <span className="preset-swatch smart-swatch">✦</span>
              <span><strong>智能匹配</strong><small>按当前照片判断</small></span>
            </button>
            {presets.map((preset) => (
              <button className={`preset-card ${activePreset === preset.id ? "active" : ""}`} type="button" key={preset.id} onClick={() => applyPreset(preset)}>
                <span className="preset-swatch" style={{ background: preset.color }} />
                <span><strong>{preset.name}</strong><small>{preset.note}</small></span>
              </button>
            ))}
          </div>

          <div className="group-tabs" role="tablist" aria-label="调整分组">
            {controlGroups.map((group, index) => (
              <button key={group.eyebrow} type="button" role="tab" aria-selected={activeGroup === index} className={activeGroup === index ? "active" : ""} onClick={() => setActiveGroup(index)}>
                <small>{group.eyebrow}</small><strong>{group.title}</strong>
              </button>
            ))}
          </div>

          <div className="slider-group" role="tabpanel">
            {controlGroups[activeGroup].fields.map((field) => (
              <label className="slider-row" key={field.key}>
                <span><b>{field.label}</b><output>{settings[field.key] > 0 ? "+" : ""}{settings[field.key]}</output></span>
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  value={settings[field.key]}
                  onChange={(event) => updateSetting(field.key, Number(event.target.value))}
                  style={{ "--range-progress": `${((settings[field.key] - field.min) / (field.max - field.min)) * 100}%` } as React.CSSProperties}
                />
              </label>
            ))}
          </div>

          {activeGroup === 1 && (
            <div className="guardrail-note"><span>肤</span><p><strong>肤色守护已开启</strong>自动抑制额头、鼻梁和脸颊的油亮高光，保留柔润哑光与真实纹理。</p></div>
          )}
          {activeGroup === 2 && (
            <div className="guardrail-note"><span>镜</span><p><strong>一种主效果就够了</strong>色散只落在画面边缘，高光溢出不覆盖五官。</p></div>
          )}

          <div className="export-area">
            <div className="export-buttons">
              <button type="button" className="share-button" onClick={shareToWeChat} disabled={isSharing || isExporting}>
                <span>{isSharing ? "准备分享图…" : "分享成片到微信"}</span><b>{isSharing ? "···" : "微"}</b>
              </button>
              <button type="button" className="export-button" onClick={exportImage} disabled={isExporting || isSharing}>
                <span>{isExporting ? "处理中" : "保存高清成片"}</span><b>{isExporting ? "···" : "↓"}</b>
              </button>
            </div>
            <p><span>●</span> 全程本地处理，不上传你的照片</p>
            {notice && <div className="notice" role="status">{notice}</div>}
          </div>
        </aside>
      </section>

      <section className="principles">
        <div className="section-number">方法 / 04</div>
        <div className="principle-copy"><span>Skill 核心口令</span><h2>先有真实瞬间，<br />再有高级质感。</h2></div>
        <ol>
          <li><span>01</span><div><strong>不改变照片里的人</strong><p>身份、表情、动作、服装与体型保持不变。</p></div></li>
          <li><span>02</span><div><strong>把人物从背景里“捞”出来</strong><p>重新组织光比、暗部和色温，让主体有分量。</p></div></li>
          <li><span>03</span><div><strong>镜头异常只放在最后</strong><p>柔光、色散、颗粒服务于瞬间，不覆盖五官。</p></div></li>
        </ol>
      </section>

      <section className="showcase">
        <div className="showcase-heading">
          <span>MODE A / 普通照片升级</span>
          <h2>保留人物和事件，<br />提升摄影完成度。</h2>
          <p>来自原 Skill 仓库的三组示例。拖动卡片上的分界线，查看光线、景深与综合色彩如何改变观看方式。</p>
        </div>
        <div className="example-grid">
          {examples.map((example, index) => (
            <figure className="example-card" key={example.name}>
              <div className="example-images">
                <img src={example.after} alt={`${example.name}升级后`} />
                <img src={example.before} alt={`${example.name}原图`} className="example-before" />
                <span className="example-divider" />
                <small className="example-tag left">BEFORE</small>
                <small className="example-tag right">AFTER</small>
              </div>
              <figcaption><span>0{index + 1}</span><strong>{example.name}</strong><small>保留身份 · 重做观看方式</small></figcaption>
            </figure>
          ))}
        </div>
      </section>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark">生</span><span><strong>生命感实验室</strong><small>FANTASY LIFE FORCE</small></span></div>
        <p>先做人，再做动作；先有阳光，再有柔光。</p>
        <a href="#top">回到顶部 ↑</a>
      </footer>

      <div className="mobile-share-dock" aria-label="手机快捷操作">
        <button type="button" className="dock-save" onClick={exportImage} disabled={isExporting || isSharing}>保存</button>
        <button type="button" className="dock-share" onClick={shareToWeChat} disabled={isSharing || isExporting}>{isSharing ? "正在准备…" : "微信分享成片"}<span>微</span></button>
      </div>

      {shareOpen && (
        <div className="share-overlay" role="presentation" onPointerDown={(event) => {
          if (event.target === event.currentTarget) closeShareGuide();
        }}>
          <section className="share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-title">
            <button className="share-close" type="button" onClick={closeShareGuide} aria-label="关闭分享引导">×</button>
            <div className="wechat-badge">微</div>
            <span className="share-eyebrow">WECHAT SHARE</span>
            <h2 id="share-title">把这张生命感成片<br />分享到微信</h2>
            {sharePreviewUrl && <img className="share-preview" src={sharePreviewUrl} alt="待分享的生命感成片" />}
            <ol className="share-steps">
              <li><span>1</span><p><strong>长按上方成片</strong>选择“保存图片”到手机相册</p></li>
              <li><span>2</span><p><strong>打开微信</strong>发送给朋友，或发布到朋友圈</p></li>
            </ol>
            <div className="share-sheet-actions">
              {sharePreviewUrl && <a href={sharePreviewUrl} download={`${fileName.replace(/\.[^/.]+$/, "") || "portrait"}-生命感.jpg`}>保存图片</a>}
              <button type="button" onClick={copyShareLink}>复制作品链接</button>
            </div>
            <p className="share-privacy">照片只在你的手机浏览器里处理，分享前不会上传。</p>
          </section>
        </div>
      )}
    </main>
  );
}
