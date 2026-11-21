let backgroundImage: Promise<HTMLImageElement> | undefined;

export function loadGlassBackdrop() {
  backgroundImage ??= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = "/ferrum-liquid-atmosphere.png";
  });
  return backgroundImage;
}

/** Crop only the existing hero artwork; never rasterise research text or controls. */
export function paintGlassBackdrop(canvas: HTMLCanvasElement, root: HTMLElement, hero: HTMLElement, image: HTMLImageElement, live: boolean, composite = false) {
  const bounds = root.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const ratio = composite ? canvas.width / bounds.width : Math.min(window.devicePixelRatio || 1, 1.25);
  const width = Math.round(bounds.width * ratio); const height = Math.round(bounds.height * ratio);
  if (!composite && (canvas.width !== width || canvas.height !== height)) { canvas.width = width; canvas.height = height; }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (!composite) {
    context.fillStyle = "#17212c";
    context.fillRect(0, 0, bounds.width, bounds.height);
  }

  const atmosphere = hero.querySelector<HTMLElement>(".hero-atmosphere");
  const region = atmosphere?.getBoundingClientRect() ?? hero.getBoundingClientRect();
  const x = region.left - bounds.left; const y = region.top - bounds.top;
  context.save();
  context.beginPath(); context.rect(x, y, region.width, region.height); context.clip();
  const cover = Math.max(region.width / image.naturalWidth, region.height / image.naturalHeight);
  const imageWidth = image.naturalWidth * cover; const imageHeight = image.naturalHeight * cover;
  context.drawImage(image, x + (region.width - imageWidth) * .5, y + (region.height - imageHeight) * (window.innerWidth <= 640 ? .73 : .72), imageWidth, imageHeight);
  if (live) {
    const source = atmosphere?.querySelector("canvas");
    if (source?.width && source.height) context.drawImage(source, x, y, region.width, region.height);
  }

  // Match the existing hero's readability wash before the library refracts it.
  if (window.innerWidth <= 640) {
    const shade = context.createLinearGradient(0, y, 0, y + region.height);
    shade.addColorStop(0, "rgba(5,8,11,.64)"); shade.addColorStop(.48, "rgba(5,8,11,.28)"); shade.addColorStop(1, "rgba(5,8,11,.7)");
    context.fillStyle = shade; context.fillRect(x, y, region.width, region.height);
  } else {
    const shade = context.createLinearGradient(x, 0, x + region.width, 0);
    shade.addColorStop(0, "rgba(5,8,11,.72)"); shade.addColorStop(.48, "rgba(5,8,11,.24)"); shade.addColorStop(1, "rgba(5,8,11,.38)");
    context.fillStyle = shade; context.fillRect(x, y, region.width, region.height);
    const depth = context.createLinearGradient(0, y, 0, y + region.height);
    depth.addColorStop(0, "rgba(5,7,9,.28)"); depth.addColorStop(.32, "rgba(5,7,9,0)"); depth.addColorStop(1, "rgba(5,7,9,.22)");
    context.fillStyle = depth; context.fillRect(x, y, region.width, region.height);
  }
  context.restore();
  if (live) {
    const particles = hero.querySelector<HTMLCanvasElement>(".hero-network canvas");
    if (particles?.width && particles.height) {
      const field = particles.getBoundingClientRect();
      context.drawImage(particles, field.left - bounds.left, field.top - bounds.top, field.width, field.height);
    }
  }
}
