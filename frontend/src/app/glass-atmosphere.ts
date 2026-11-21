/** This is the visible environment AND the optical source, never a fake image
 * pasted only inside cards. Route phases keep the compositions related but distinct. */
export function paintAtmosphere(canvas: HTMLCanvasElement, view: string, time: number, scroll: number, ratio: number) {
  const w = innerWidth, h = innerHeight;
  const pw = Math.ceil(w * ratio), ph = Math.ceil(h * ratio);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const phase = ["Overview", "Company", "Sector", "Compare", "Rankings", "Methodology", "Intelligence"].indexOf(view) * .7;
  const t = time * .001;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#17212c"); gradient.addColorStop(.48, "#26333f"); gradient.addColorStop(1, "#151e28");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  const lightX = w * (.68 + .2 * Math.sin(t * .13 + phase));
  const lightY = h * (.36 + .25 * Math.cos(t * .17 + phase)) - Math.sin(scroll / 1800) * 90;
  const glow = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, w * .65);
  glow.addColorStop(0, "rgba(167,183,193,.22)"); glow.addColorStop(.42, "rgba(107,134,151,.09)"); glow.addColorStop(1, "rgba(130,150,165,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  // Fine metallic contours give a clear lens something sharp to displace.
  for (let i = 0; i < 19; i++) {
    const base = h * (.06 + i * .061) - Math.sin(scroll / 1900) * h * .18;
    const tide = Math.sin(t * .24 + phase + i * .13) * h * .11;
    ctx.beginPath(); ctx.moveTo(-50, base + tide);
    ctx.bezierCurveTo(w * .28, base - h * .38 + tide, w * .56, base + h * .45 + tide, w + 60, base - h * .12);
    ctx.lineWidth = i % 5 === 0 ? 1.25 : .65;
    ctx.strokeStyle = `rgba(200,218,228,${i % 5 === 0 ? .19 : .065})`; ctx.stroke();
  }
  // A second, restrained cross-current provides depth on long article pages.
  ctx.beginPath(); ctx.moveTo(w * .08, h + 30);
  ctx.bezierCurveTo(w * (.4 + .08 * Math.sin(t * .19 + phase)), h * .1, w * .95, h * .8, w * .82, -30);
  ctx.strokeStyle = "rgba(211,226,235,.12)"; ctx.lineWidth = 1; ctx.stroke();
}
