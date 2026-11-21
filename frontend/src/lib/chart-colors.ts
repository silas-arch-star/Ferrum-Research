/** Presentation only: fixed domains and stable identities; no data transforms. */
export const chartColors = {
  positive: "#64c7a2", negative: "#ed897d", warning: "#e7b668",
  fundamental: "#79bde8", technical: "#c0a4e9", integrated: "#78c9bd",
  metrics: { Growth: "#79bde8", Profitability: "#78c9bd", Valuation: "#c0a4e9", Leverage: "#e7b668", Liquidity: "#9cceda", "Cash flow": "#98c98d" },
};

// Fixed anchors keep the legend and cells consistent as filters change.
const heatStops = [[164, 32, 53], [246, 207, 103], [27, 123, 72]];
const rgb = (channels: number[]) => `rgb(${channels.join(", ")})`;
export const scoreHeatGradient = `linear-gradient(90deg in srgb, ${heatStops.map(rgb).join(", ")})`;

export function scoreHeatStyle(value: number) {
  const position = Math.max(0, Math.min(100, value)) / 50;
  const band = position < 1 ? 0 : 1;
  const channels = heatStops[band].map((start, index) =>
    Math.round(start + (heatStops[band + 1][index] - start) * (position - band)),
  );
  const [red, green, blue] = channels.map(channel => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return { backgroundColor: rgb(channels), color: luminance >= 0.179 ? "#000" : "#fff" };
}

const categorical = ["#86bde8", "#77c9b4", "#d4b6eb", "#e7bd80", "#d690a4", "#b0c994", "#91cbd7", "#b5afe9"];
export function companyColor(id: string): string {
  const index = Number(id.replace(/\D/g, ""));
  return categorical[(Math.max(1, index) - 1) % categorical.length];
}
