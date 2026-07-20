export const imageStyles = {
  sunlight: {
    label: "阳光生命力",
    prompt: "strong real sunlight, sun-kissed colors, clean open shadows, subtle highlight bloom",
  },
  cinema: {
    label: "电影侧光",
    prompt: "cinematic side light, intimate lens distance, layered depth, restrained warm color contrast",
  },
  pool: {
    label: "泳池焦散",
    prompt: "clear pool-blue palette, water caustics on clothing and background, bright droplets near the lens",
  },
  cafe: {
    label: "咖啡馆氛围",
    prompt: "warm cafe memory, soft window side light, gentle dark tones, foreground glass reflections",
  },
} as const;

export type ImageStyleId = keyof typeof imageStyles;

export function buildLifeForcePrompt(description: string, styleId: ImageStyleId) {
  const cleanDescription = description.trim().slice(0, 600);
  const style = imageStyles[styleId] ?? imageStyles.sunlight;

  return [
    "Create one original 3:4 vertical life-force portrait photograph.",
    cleanDescription || "A relaxed young Chinese adult caught in a real summer moment on a city rooftop.",
    style.prompt + ".",
    "The person is an original Chinese or East Asian adult, not a celebrity and not identifiable as a real person.",
    "Use a close, active camera, an imperfect spontaneous crop, a specific ongoing action, foreground depth and a believable environment.",
    "Skin is clean soft-matte with real texture, never oily, plastic or over-retouched. Keep eyes, nose and lips crisp and readable.",
    "Use one clear main color relationship and only one restrained optical effect on edges, hair, glass, water or background bokeh.",
    "No text, no border, no watermark, no collage, no commercial advertising pose, no generic AI doll face.",
  ].join(" ");
}
