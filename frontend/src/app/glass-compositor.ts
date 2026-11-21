import type { GlassConfig } from "@ybouane/liquidglass";

export type GlassBox = { x: number; y: number; width: number; height: number };

const vertex = `attribute vec2 position;
varying vec2 uv;
void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;

// The lens is evaluated in the FULL DOM rectangle; the raster tile is only its
// viewport intersection. Clipping never invents a bevel at the viewport boundary.
const fragment = `precision highp float;
varying vec2 uv;
uniform sampler2D backdrop;
uniform vec2 viewport;
uniform vec4 panel, clip;
uniform vec4 material;
uniform vec3 interaction;
uniform float time, radius;
float sdf(vec2 p){
  vec2 q=abs(p)-panel.zw*.5+radius;
  return length(max(q,0.))+min(max(q.x,q.y),0.)-radius;
}
vec3 sampleScene(vec2 p){return texture2D(backdrop,clamp(p/viewport,vec2(.001),vec2(.999))).rgb;}
void main(){
  vec2 screen=clip.xy+uv*clip.zw;
  vec2 p=screen-panel.xy-panel.zw*.5;
  float d=sdf(p);
  float mask=1.-smoothstep(-1.4,.4,d);
  if(mask<.001){gl_FragColor=vec4(0.);return;}
  vec2 normal=normalize(vec2(sdf(p+vec2(1.,0.))-sdf(p-vec2(1.,0.)),sdf(p+vec2(0.,1.))-sdf(p-vec2(0.,1.)))+vec2(.00001));
  float bevel=exp(min(d,0.)/max(material.z,1.));
  vec2 flow=vec2(sin(p.y*.009+time*.8)+sin(p.x*.004-time*.47),cos(p.x*.008-time*.62));
  vec2 cursor=screen-interaction.xy;
  float influence=exp(-dot(cursor,cursor)/32000.)*interaction.z;
  vec2 displacement=-normal*bevel*(12.+5.*sin(time*.43))*material.x;
  displacement+=flow*(1.3+material.y*12.)+normalize(cursor+vec2(.01))*influence*5.;
  vec2 dispersion=normal*bevel*.32;
  vec3 color=vec3(sampleScene(screen+displacement+dispersion).r,sampleScene(screen+displacement).g,sampleScene(screen+displacement-dispersion).b);
  float light=.5+.5*dot(normal,normalize(vec2(cos(time*.53),sin(time*.53))));
  float rim=exp(-abs(d+1.3)*.75)*(.045+.19*pow(light,4.));
  float fresnel=bevel*bevel*(.012+.045*pow(light,7.));
  float glint=pow(max(0.,cos(p.x*.004+p.y*.006-time*.7)),26.)*bevel*.035;
  color+=vec3(rim+fresnel+glint)*(1.+interaction.z*.35)*material.w;
  gl_FragColor=vec4(color,mask);
}`;

/** One program, one shared background texture, no per-panel FBOs or captures. */
export class GlassCompositor {
  readonly canvas = document.createElement("canvas");
  readonly gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private buffer: WebGLBuffer;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private textureWidth = 0;
  private textureHeight = 0;
  private snapshot = document.createElement("canvas");
  private onLost = (event: Event) => { event.preventDefault(); this.onUnavailable(); };
  constructor(private onUnavailable: () => void) {
    const gl = this.canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: "low-power" });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message ?? "Glass shader failed"); }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    this.program = gl.createProgram()!; gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error("Glass program failed");
    gl.useProgram(this.program);
    this.buffer = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(this.program, "position"); gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    this.texture = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // DOM canvases arrive top-down. Both shader coordinates and texture UVs use
    // that convention, so no UNPACK_FLIP_Y_WEBGL is needed.
    for (const key of ["backdrop", "viewport", "panel", "clip", "material", "interaction", "time", "radius"]) this.uniforms[key] = gl.getUniformLocation(this.program, key);
    gl.uniform1i(this.uniforms.backdrop, 0); gl.disable(gl.DEPTH_TEST); gl.enable(gl.SCISSOR_TEST);
    this.canvas.className = "glass-render-stage"; this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.addEventListener("webglcontextlost", this.onLost);
    // A lost context uses clear transparency until the browser restores it;
    // rebuilding is owned by ApplicationGlass, never by an extra render loop.
  }
  upload(source: HTMLCanvasElement, width: number, height: number, ratio: number) {
    const gl = this.gl;
    const w = Math.ceil(width * ratio), h = Math.ceil(height * ratio);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    if (this.textureWidth !== source.width || this.textureHeight !== source.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      this.textureWidth = source.width; this.textureHeight = source.height;
    } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform2f(this.uniforms.viewport, width, height);
    gl.scissor(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  render(box: GlassBox, clip: GlassBox, config: GlassConfig, radius: number, time: number, pointer: { x: number; y: number; hover: number }, ratio: number) {
    const gl = this.gl, x = Math.floor(clip.x * ratio), y = Math.floor(clip.y * ratio);
    const w = Math.ceil((clip.x + clip.width) * ratio) - x, h = Math.ceil((clip.y + clip.height) * ratio) - y;
    // WebGL scissors start at bottom-left; canvas drawImage starts at top-left.
    gl.viewport(x, this.canvas.height - y - h, w, h); gl.scissor(x, this.canvas.height - y - h, w, h);
    gl.uniform4f(this.uniforms.panel, box.x, box.y, box.width, box.height);
    gl.uniform4f(this.uniforms.clip, clip.x, clip.y, clip.width, clip.height);
    gl.uniform4f(this.uniforms.material, config.refraction, config.distortion, config.zRadius, config.edgeHighlight * 2);
    gl.uniform3f(this.uniforms.interaction, pointer.x, pointer.y, pointer.hover);
    gl.uniform1f(this.uniforms.radius, Math.min(radius, box.width / 2, box.height / 2)); gl.uniform1f(this.uniforms.time, time);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  capture() {
    if (this.snapshot.width !== this.canvas.width || this.snapshot.height !== this.canvas.height) { this.snapshot.width = this.canvas.width; this.snapshot.height = this.canvas.height; }
    const ctx = this.snapshot.getContext("2d")!;
    ctx.clearRect(0, 0, this.snapshot.width, this.snapshot.height); ctx.drawImage(this.canvas, 0, 0);
  }
  publish(clip: GlassBox, ratio: number, output: HTMLCanvasElement) {
    const w = Math.ceil(clip.width * ratio), h = Math.ceil(clip.height * ratio);
    if (output.width !== w || output.height !== h) { output.width = w; output.height = h; }
    const ctx = output.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.snapshot, clip.x * ratio, clip.y * ratio, clip.width * ratio, clip.height * ratio, 0, 0, w, h);
  }
  destroy() {
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    const gl = this.gl; gl.deleteBuffer(this.buffer); gl.deleteTexture(this.texture); gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext(); this.canvas.remove();
  }
}
