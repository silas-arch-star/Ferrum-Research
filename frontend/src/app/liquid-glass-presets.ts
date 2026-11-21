import type { GlassConfig } from "@ybouane/liquidglass";

const common: GlassConfig = {
  blurAmount: 0, refraction: .82, chromAberration: .04, edgeHighlight: .44,
  specular: .35, fresnel: 1, distortion: .14, cornerRadius: 30, zRadius: 40,
  opacity: 1, saturation: 0, tintStrength: 0, brightness: 0,
  shadowOpacity: .3, shadowSpread: 10, shadowOffsetY: 2,
  floating: false, button: false, bevelMode: 0,
};

export const GLASS_PRESETS = {
  navigation: { ...common, refraction: .78, chromAberration: .025, edgeHighlight: .32, specular: .24, distortion: .1, cornerRadius: 20, zRadius: 18, opacity: .92, brightness: .02 },
  editorial: { ...common, refraction: .76, chromAberration: .02, distortion: .09, cornerRadius: 18, zRadius: 26, specular: .28 },
  data: { ...common, refraction: .8, chromAberration: .015, distortion: .07, cornerRadius: 18, zRadius: 28, edgeHighlight: .34, specular: .26 },
  interactive: { ...common, refraction: .74, chromAberration: .02, distortion: .09, cornerRadius: 12, zRadius: 18, specular: .3 },
  cinematic: { ...common, refraction: .88, chromAberration: .055, edgeHighlight: .5, specular: .42, distortion: .18, cornerRadius: 18, zRadius: 24, opacity: .96, brightness: .045 },
} satisfies Record<string, GlassConfig>;

export type GlassPreset = keyof typeof GLASS_PRESETS;

// Budget raster work, never panel size/count. All visible panels receive optics.
export const GLASS_RENDER_LIMITS = {
  dpr: 1.25, minDpr: .55, framePixels: 2_400_000, interval: 32,
} as const;
