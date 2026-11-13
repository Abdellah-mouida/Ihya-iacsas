'use client';

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { Renderer, Triangle, Program, Mesh, Texture } from 'ogl';
import { gsap } from 'gsap';
import { MorphCrossfade } from '@/components/morph-crossfade';

import './MorphSlider.css';

const TRANSITIONS = { melt: 0, ripple: 1, shear: 2, swirl: 3 };
const IDLE_FRAME_MS = 1000 / 30;

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform sampler2D tCurrent;
uniform sampler2D tNext;
uniform vec2 uResolution;
uniform vec2 uCurrentSize;
uniform vec2 uNextSize;
uniform float uProgress;
uniform float uDir;
uniform int uMode;
uniform float uIntensity;
uniform float uScale;
uniform float uAberration;
uniform float uDrift;
uniform float uTime;
uniform float uReduce;
uniform vec2 uPointer;
uniform vec3 uOverlay;

varying vec2 vUv;

const float PI = 3.14159265359;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

vec2 coverUV(vec2 uv, vec2 res, vec2 img) {
  float rA = res.x / max(res.y, 1.0);
  float iA = img.x / max(img.y, 1.0);
  vec2 s = vec2(1.0);
  float ratio = rA / max(iA, 0.0001);
  if (ratio > 1.0) {
    s.y = 1.0 / ratio;
  } else {
    s.x = ratio;
  }
  return (uv - 0.5) * s + 0.5;
}

void main() {
  float p = clamp(uProgress, 0.0, 1.0);
  float env = sin(p * PI);

  vec2 uv = vUv;

  uv += vec2(sin(uTime * 0.25 + uv.y * 4.0), cos(uTime * 0.22 + uv.x * 4.0)) * uDrift * 0.008;
  uv = (uv - 0.5) * (1.0 - uDrift * 0.02 * sin(uTime * 0.4)) + 0.5;

  vec2 uvC = uv;
  vec2 uvN = uv;
  float m = smoothstep(0.0, 1.0, p);

  if (uReduce < 0.5) {
    if (uMode == 3) {
      vec2 c = uv - 0.5;
      float r = length(c);
      float ang = env * uIntensity * 3.5 * (1.0 - r);
      uvC = rot(ang) * c + 0.5;
      uvN = rot(-ang) * c + 0.5;
      m = smoothstep(0.0, 1.0, p);
    } else if (uMode == 1) {
      float d = distance(uv, uPointer);
      float ring = p * 1.6;
      float wave = sin((d - ring) * 30.0) * env;
      vec2 dir = normalize(uv - uPointer + 1e-4);
      vec2 disp = dir * wave * uIntensity * 0.25;
      uvC = uv + disp;
      uvN = uv + disp * 0.6;
      m = 1.0 - smoothstep(ring - 0.03, ring + 0.03, d);
    } else if (uMode == 2) {
      float slices = 14.0;
      float row = floor(uv.y * slices);
      float rnd = hash11(row);
      vec2 disp = vec2((rnd - 0.5) * env * uIntensity * 0.6, 0.0);
      uvC = uv + disp;
      uvN = uv + disp;
      float localX = uDir > 0.0 ? uv.x : 1.0 - uv.x;
      float th = p * 1.5 - 0.25 + (rnd - 0.5) * 0.25;
      m = 1.0 - smoothstep(th - 0.06, th + 0.06, localX);
    } else {
      float nn = fbm(uv * uScale + uTime * 0.03);
      float warp = fbm(uv * uScale * 1.7 - uTime * 0.02);
      vec2 g = vec2(nn, warp) - 0.5;
      uvC = uv + g * uIntensity * 0.5 * p;
      uvN = uv - g * uIntensity * 0.5 * (1.0 - p);
      m = smoothstep(nn - 0.15, nn + 0.15, p);
    }
  }

  vec2 sC = coverUV(uvC, uResolution, uCurrentSize);
  vec2 sN = coverUV(uvN, uResolution, uNextSize);

  float ca = uReduce < 0.5 ? uAberration * env * 0.03 : 0.0;

  vec3 colC = vec3(
    texture2D(tCurrent, sC + vec2(ca, 0.0)).r,
    texture2D(tCurrent, sC).g,
    texture2D(tCurrent, sC - vec2(ca, 0.0)).b
  );
  vec3 colN = vec3(
    texture2D(tNext, sN + vec2(ca, 0.0)).r,
    texture2D(tNext, sN).g,
    texture2D(tNext, sN - vec2(ca, 0.0)).b
  );

  vec3 col = mix(colC, colN, m);

  float vig = smoothstep(1.25, 0.25, length(uv - 0.5));
  col = mix(col, uOverlay, (1.0 - vig) * 0.28);

  gl_FragColor = vec4(col, 1.0);
}
`;

function makeFallbackTexture(gl) {
  const size = 4;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = 24;
    data[i * 4 + 1] = 24;
    data[i * 4 + 2] = 28;
    data[i * 4 + 3] = 255;
  }
  return new Texture(gl, { image: data, width: size, height: size, generateMipmaps: false });
}

function resolveCssColorRgb(tokenName) {
  if (typeof window === 'undefined') return [0, 0, 0];
  const raw =
    getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim() || '#000000';
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

class MorphEngine {
  constructor(
    container,
    {
      items,
      startIndex,
      reducedMotion,
      lowPower,
      getOptions,
      onIndexChange,
      onFirstFrame,
      onContextLost,
      onRenderStateChange,
      dprCap,
      antialias
    }
  ) {
    this.container = container;
    this.items = items;
    this.getOptions = getOptions;
    this.onIndexChange = onIndexChange;
    this.onFirstFrame = onFirstFrame;
    this.onContextLostCallback = onContextLost;
    this.onRenderStateChange = onRenderStateChange;
    this.reducedMotion = reducedMotion;
    this.lowPower = lowPower;

    this.current = startIndex;
    this.animating = false;
    this.dragging = false;
    this.dragDir = 0;
    this.shownIndex = startIndex;
    this.tween = null;
    this.destroyed = false;
    this.firstFrameSent = false;
    this.inView = true;
    this.pageHidden = typeof document !== 'undefined' ? document.hidden : false;
    this.raf = null;
    this.lastIdleRender = 0;
    this.overlayRgb = resolveCssColorRgb('--background');

    this.renderer = new Renderer({
      alpha: false,
      antialias,
      dpr: Math.min(window.devicePixelRatio || 1, dprCap)
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(this.overlayRgb[0], this.overlayRgb[1], this.overlayRgb[2], 1);

    this.canvas = this.gl.canvas;
    this.canvas.className = 'morph-slider-canvas';
    container.appendChild(this.canvas);

    this.geometry = new Triangle(this.gl);
    this.fallbackTexture = makeFallbackTexture(this.gl);
    this.textures = new Array(this.items.length).fill(null);
    this.loadingTokens = new Array(this.items.length).fill(0);
    this.sizes = this.items.map(() => [1, 1]);

    const opts = this.getOptions();
    this.program = new Program(this.gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        tCurrent: { value: this.fallbackTexture },
        tNext: { value: this.fallbackTexture },
        uResolution: { value: [1, 1] },
        uCurrentSize: { value: this.sizes[this.current] },
        uNextSize: { value: this.sizes[this.current] },
        uProgress: { value: 0 },
        uDir: { value: 1 },
        uMode: { value: TRANSITIONS[opts.transition] ?? 0 },
        uIntensity: { value: opts.intensity },
        uScale: { value: opts.scale },
        uAberration: { value: opts.aberration },
        uDrift: { value: this.lowPower || this.reducedMotion ? 0 : opts.drift },
        uTime: { value: 0 },
        uReduce: { value: reducedMotion ? 1 : 0 },
        uPointer: { value: [0.5, 0.5] },
        uOverlay: { value: this.overlayRgb }
      }
    });

    this.mesh = new Mesh(this.gl, { geometry: this.geometry, program: this.program });

    this.boundContextLost = this.handleContextLost.bind(this);
    this.canvas.addEventListener('webglcontextlost', this.boundContextLost, false);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.ensureWindowTextures();
    this.boundLoop = this.loop.bind(this);
    this.scheduleLoop();
  }

  refreshThemeColor() {
    if (this.destroyed) return;
    this.overlayRgb = resolveCssColorRgb('--background');
    this.gl.clearColor(this.overlayRgb[0], this.overlayRgb[1], this.overlayRgb[2], 1);
    this.program.uniforms.uOverlay.value = this.overlayRgb;
    this.renderNow();
  }

  setVisibility({ inView, pageHidden }) {
    if (typeof inView === 'boolean') this.inView = inView;
    if (typeof pageHidden === 'boolean') this.pageHidden = pageHidden;
    if (!this.inView || this.pageHidden) {
      this.stopLoop();
    } else {
      this.scheduleLoop();
    }
  }

  wantsContinuousRender() {
    if (this.destroyed || !this.inView || this.pageHidden) return false;
    if (this.animating || this.dragging) return true;
    const opts = this.getOptions();
    return !this.reducedMotion && !this.lowPower && opts.drift > 0;
  }

  scheduleLoop() {
    if (this.destroyed) return;
    if (!this.wantsContinuousRender()) {
      this.stopLoop();
      return;
    }
    if (this.raf !== null) return;
    this.onRenderStateChange?.(true);
    this.raf = requestAnimationFrame(this.boundLoop);
  }

  stopLoop() {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    this.onRenderStateChange?.(false);
  }

  renderNow() {
    if (this.destroyed) return;
    this.syncOptions();
    this.renderer.render({ scene: this.mesh });
  }

  getWindowIndices() {
    const n = this.items.length;
    if (n === 0) return new Set();
    if (n === 1) return new Set([0]);
    if (n === 2) return new Set([0, 1]);
    return new Set([this.wrap(this.current - 1), this.current, this.wrap(this.current + 1)]);
  }

  ensureWindowTextures() {
    const keep = this.getWindowIndices();
    for (let i = 0; i < this.items.length; i++) {
      if (!keep.has(i)) {
        this.loadingTokens[i] += 1;
        const tex = this.textures[i];
        if (tex && tex !== this.fallbackTexture) {
          if (tex.texture) this.gl.deleteTexture(tex.texture);
          this.textures[i] = null;
          this.sizes[i] = [1, 1];
        }
      }
    }

    keep.forEach(index => {
      if (this.textures[index]) return;
      const item = this.items[index];
      if (!item?.image) return;
      const token = ++this.loadingTokens[index];
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => {
        if (this.destroyed || token !== this.loadingTokens[index]) return;
        const texture = new Texture(this.gl, { generateMipmaps: false });
        texture.image = img;
        this.textures[index] = texture;
        this.sizes[index] = [img.naturalWidth || 1, img.naturalHeight || 1];
        if (index === this.current) {
          this.program.uniforms.tCurrent.value = texture;
          this.program.uniforms.uCurrentSize.value = this.sizes[index];
          this.renderNow();
          if (!this.firstFrameSent) {
            this.firstFrameSent = true;
            this.canvas.classList.add('is-ready');
            this.onFirstFrame?.();
          }
        } else if (this.animating || this.dragging) {
          this.program.uniforms.tNext.value = texture;
          this.program.uniforms.uNextSize.value = this.sizes[index];
        }
      };
      img.onerror = () => {};
      img.src = item.image;
    });
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    this.renderer.setSize(w, h);
    this.program.uniforms.uResolution.value = [this.gl.canvas.width, this.gl.canvas.height];
    this.renderNow();
  }

  syncOptions() {
    const opts = this.getOptions();
    this.program.uniforms.uMode.value = TRANSITIONS[opts.transition] ?? 0;
    this.program.uniforms.uIntensity.value = opts.intensity;
    this.program.uniforms.uScale.value = opts.scale;
    this.program.uniforms.uAberration.value = opts.aberration;
    this.program.uniforms.uDrift.value = this.lowPower || this.reducedMotion ? 0 : opts.drift;
    this.program.uniforms.uOverlay.value = this.overlayRgb;
  }

  loop(t) {
    this.raf = null;
    if (!this.wantsContinuousRender()) {
      this.onRenderStateChange?.(false);
      return;
    }

    if (this.animating || this.dragging) {
      this.program.uniforms.uTime.value = t * 0.001;
      this.renderer.render({ scene: this.mesh });
    } else if (t - this.lastIdleRender >= IDLE_FRAME_MS) {
      this.lastIdleRender = t;
      this.program.uniforms.uTime.value = t * 0.001;
      this.syncOptions();
      this.renderer.render({ scene: this.mesh });
    }

    this.scheduleLoop();
  }

  wrap(i) {
    const n = this.items.length;
    return ((i % n) + n) % n;
  }

  prepareNext(dir) {
    const target = this.wrap(this.current + dir);
    this.program.uniforms.tCurrent.value = this.textures[this.current] ?? this.fallbackTexture;
    this.program.uniforms.uCurrentSize.value = this.sizes[this.current];
    this.program.uniforms.tNext.value = this.textures[target] ?? this.fallbackTexture;
    this.program.uniforms.uNextSize.value = this.sizes[target];
    this.program.uniforms.uDir.value = dir;
    return target;
  }

  goTo(dir) {
    if (this.animating || this.dragging || this.items.length < 2) return;
    const opts = this.getOptions();
    if (!opts.loop) {
      const raw = this.current + dir;
      if (raw < 0 || raw > this.items.length - 1) return;
    }
    this.syncOptions();
    const target = this.prepareNext(dir);
    this.animating = true;
    this.scheduleLoop();
    this.announce(target);
    const duration = this.reducedMotion || this.lowPower ? Math.min(opts.duration, 0.45) : opts.duration;
    this.tween = gsap.fromTo(
      this.program.uniforms.uProgress,
      { value: 0 },
      {
        value: 1,
        duration,
        ease: opts.ease,
        onComplete: () => this.commit(target)
      }
    );
  }

  goToIndex(targetIndex) {
    if (this.animating || this.dragging || this.items.length < 2) return;
    const target = this.wrap(targetIndex);
    if (target === this.current) return;
    const dir = target > this.current ? 1 : -1;
    this.syncOptions();
    this.program.uniforms.tCurrent.value = this.textures[this.current] ?? this.fallbackTexture;
    this.program.uniforms.uCurrentSize.value = this.sizes[this.current];
    this.program.uniforms.tNext.value = this.textures[target] ?? this.fallbackTexture;
    this.program.uniforms.uNextSize.value = this.sizes[target];
    this.program.uniforms.uDir.value = dir;
    this.animating = true;
    this.scheduleLoop();
    this.announce(target);
    const opts = this.getOptions();
    const duration = this.reducedMotion || this.lowPower ? Math.min(opts.duration, 0.45) : opts.duration;
    this.tween = gsap.fromTo(
      this.program.uniforms.uProgress,
      { value: 0 },
      {
        value: 1,
        duration,
        ease: opts.ease,
        onComplete: () => this.commit(target)
      }
    );
  }

  announce(index) {
    if (index === this.shownIndex) return;
    this.shownIndex = index;
    this.onIndexChange?.(index);
  }

  commit(target) {
    this.current = target;
    this.program.uniforms.tCurrent.value = this.textures[target] ?? this.fallbackTexture;
    this.program.uniforms.uCurrentSize.value = this.sizes[target];
    this.program.uniforms.uProgress.value = 0;
    this.animating = false;
    this.tween = null;
    this.announce(target);
    this.ensureWindowTextures();
    this.renderNow();
    this.scheduleLoop();
  }

  next() {
    this.goTo(1);
  }

  prev() {
    this.goTo(-1);
  }

  setPointer(x, y) {
    this.program.uniforms.uPointer.value = [x, y];
  }

  beginDrag() {
    if (this.animating || this.items.length < 2) return false;
    this.dragging = true;
    this.dragDir = 0;
    this.syncOptions();
    this.scheduleLoop();
    return true;
  }

  drag(ndx) {
    if (!this.dragging) return;
    const opts = this.getOptions();
    const dir = ndx < 0 ? 1 : -1;
    if (!opts.loop) {
      const raw = this.current + dir;
      if (raw < 0 || raw > this.items.length - 1) {
        this.program.uniforms.uProgress.value = 0;
        return;
      }
    }
    if (dir !== this.dragDir) {
      this.dragDir = dir;
      this.prepareNext(dir);
    }
    const progress = Math.min(Math.abs(ndx), 1);
    this.program.uniforms.uProgress.value = progress;
    this.announce(progress > 0.5 ? this.wrap(this.current + dir) : this.current);
  }

  endDrag() {
    if (!this.dragging) return;
    this.dragging = false;
    const p = this.program.uniforms.uProgress.value;
    if (this.dragDir === 0) {
      this.scheduleLoop();
      return;
    }
    const target = this.wrap(this.current + this.dragDir);
    const duration = this.reducedMotion || this.lowPower ? 0.3 : 0.45;
    this.animating = true;
    this.scheduleLoop();
    if (p > 0.4) {
      this.announce(target);
      this.tween = gsap.to(this.program.uniforms.uProgress, {
        value: 1,
        duration,
        ease: 'power2.out',
        onComplete: () => this.commit(target)
      });
    } else {
      this.announce(this.current);
      this.tween = gsap.to(this.program.uniforms.uProgress, {
        value: 0,
        duration,
        ease: 'power2.out',
        onComplete: () => {
          this.animating = false;
          this.tween = null;
          this.renderNow();
          this.scheduleLoop();
        }
      });
    }
  }

  handleContextLost(e) {
    e.preventDefault();
    this.stopLoop();
    this.onContextLostCallback?.();
  }

  destroy() {
    this.destroyed = true;
    this.stopLoop();
    if (this.tween) this.tween.kill();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.boundContextLost);
    this.textures.forEach(tex => {
      if (tex && tex.texture) this.gl.deleteTexture(tex.texture);
    });
    if (this.fallbackTexture?.texture) this.gl.deleteTexture(this.fallbackTexture.texture);
    if (this.program && this.program.program) this.gl.deleteProgram(this.program.program);
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}

const DEFAULT_LABELS = {
  sliderLabel: 'Gallery slider',
  slidesLabel: 'Gallery slides',
  previousSlide: 'Previous slide',
  nextSlide: 'Next slide',
  goToSlide: 'Go to slide {n}'
};

/**
 * @typedef {{ image: string; alt?: string; caption?: string; date?: string }} MorphSlideItem
 * @typedef {object} MorphSliderProps
 * @property {MorphSlideItem[]} [items]
 * @property {number} [startIndex]
 * @property {'melt'|'ripple'|'shear'|'swirl'} [transition]
 * @property {number} [duration]
 * @property {string} [ease]
 * @property {number} [intensity]
 * @property {number} [scale]
 * @property {number} [aberration]
 * @property {number} [drift]
 * @property {boolean} [autoplay]
 * @property {number} [autoplayDelay]
 * @property {boolean} [loop]
 * @property {boolean} [showCaptions]
 * @property {boolean} [showControls]
 * @property {boolean} [showIndicators]
 * @property {boolean} [lowPower]
 * @property {boolean} [forceFallback]
 * @property {'ltr'|'rtl'} [dir]
 * @property {Partial<typeof DEFAULT_LABELS>} [labels]
 * @property {string} [className]
 */

/** @param {MorphSliderProps & Record<string, any>} props */
export default function MorphSlider({
  items = [],
  startIndex = 0,
  transition = 'melt',
  duration = 1.0,
  ease = 'power2.inOut',
  intensity = 0.38,
  scale = 2.2,
  aberration = 0.22,
  drift = 0.25,
  autoplay = false,
  autoplayDelay = 3,
  loop = true,
  showCaptions = true,
  showControls = true,
  showIndicators = true,
  lowPower = false,
  forceFallback = false,
  dir = 'ltr',
  labels: labelsProp,
  className = '',
  ...props
}) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const engineRef = useRef(null);
  const [index, setIndex] = useState(startIndex);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageHidden, setPageHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const inViewRef = useRef(true);

  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const isRtl = dir === 'rtl';

  const optsRef = useRef({
    transition,
    duration,
    ease,
    intensity,
    scale,
    aberration,
    drift,
    loop
  });

  useLayoutEffect(() => {
    inViewRef.current = inView;
    optsRef.current = { transition, duration, ease, intensity, scale, aberration, drift, loop };
  }, [inView, transition, duration, ease, intensity, scale, aberration, drift, loop]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReducedMotion(Boolean(mq?.matches));
    syncMotion();
    mq?.addEventListener?.('change', syncMotion);
    return () => mq?.removeEventListener?.('change', syncMotion);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setInView(visible);
        engineRef.current?.setVisibility({ inView: visible });
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.hidden;
      setPageHidden(hidden);
      engineRef.current?.setVisibility({ pageHidden: hidden });
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const useCrossfadeFallback = forceFallback || reducedMotion || webglFailed;

  useEffect(() => {
    if (useCrossfadeFallback || !stageRef.current || items.length === 0) return undefined;

    let engine;
    try {
      engine = new MorphEngine(stageRef.current, {
        items,
        startIndex,
        reducedMotion,
        lowPower,
        dprCap: lowPower ? 1 : 1.5,
        antialias: !lowPower,
        getOptions: () => optsRef.current,
        onIndexChange: setIndex,
        onFirstFrame: () => setFirstFrameReady(true),
        onContextLost: () => setWebglFailed(true),
        onRenderStateChange: setIsRendering
      });
    } catch {
      queueMicrotask(() => setWebglFailed(true));
      return undefined;
    }

    engineRef.current = engine;
    engine.setVisibility({ inView: inViewRef.current, pageHidden: document.hidden });

    const themeObserver = new MutationObserver(() => engine.refreshThemeColor());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class']
    });

    return () => {
      themeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
      setFirstFrameReady(false);
      setIsRendering(false);
    };
  }, [items, startIndex, useCrossfadeFallback, reducedMotion, lowPower]);

  const safeIndex = items.length > 0 ? ((index % items.length) + items.length) % items.length : 0;

  const stepFallback = useCallback(
    delta => {
      if (items.length < 2) return;
      setIndex(prev => {
        const raw = prev + delta;
        if (!loop) return Math.max(0, Math.min(items.length - 1, raw));
        return (raw + items.length) % items.length;
      });
    },
    [items.length, loop]
  );

  const handleNext = useCallback(() => {
    if (useCrossfadeFallback) {
      stepFallback(1);
    } else {
      engineRef.current?.next();
    }
  }, [useCrossfadeFallback, stepFallback]);

  const handlePrev = useCallback(() => {
    if (useCrossfadeFallback) {
      stepFallback(-1);
    } else {
      engineRef.current?.prev();
    }
  }, [useCrossfadeFallback, stepFallback]);

  const handleGoToIndex = useCallback(
    target => {
      if (useCrossfadeFallback) {
        setIndex(target);
      } else {
        engineRef.current?.goToIndex(target);
      }
    },
    [useCrossfadeFallback]
  );

  useEffect(() => {
    if (!autoplay || lowPower || reducedMotion || hovering || focusWithin || !inView || pageHidden || items.length < 2) {
      return undefined;
    }
    const id = window.setTimeout(handleNext, Math.max(autoplayDelay, 1) * 1000);
    return () => window.clearTimeout(id);
  }, [autoplay, autoplayDelay, lowPower, reducedMotion, hovering, focusWithin, inView, pageHidden, items.length, safeIndex, handleNext]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || useCrossfadeFallback) return undefined;
    let startX = 0;
    let width = 1;
    let active = false;

    const onDown = e => {
      const rect = el.getBoundingClientRect();
      width = rect.width || 1;
      startX = e.clientX;
      const px = (e.clientX - rect.left) / width;
      const py = (e.clientY - rect.top) / (rect.height || 1);
      engineRef.current?.setPointer(px, 1 - py);
      active = engineRef.current?.beginDrag() ?? false;
      if (active && el.setPointerCapture) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
      }
    };
    const onMove = e => {
      if (!active) return;
      const rawNdx = (e.clientX - startX) / width;
      engineRef.current?.drag(isRtl ? -rawNdx : rawNdx);
    };
    const onUp = () => {
      if (!active) return;
      active = false;
      engineRef.current?.endDrag();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [useCrossfadeFallback, isRtl]);

  const onKeyDown = useCallback(
    e => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isRtl) handlePrev();
        else handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isRtl) handleNext();
        else handlePrev();
      }
    },
    [handleNext, handlePrev, isRtl]
  );

  const hasCaptions = items.some(item => item.caption);
  const effectiveDuration = reducedMotion || lowPower ? Math.min(duration, 0.45) : duration;
  const firstItem = items[startIndex] ?? items[0];

  if (useCrossfadeFallback) {
    return (
      <MorphCrossfade
        items={items}
        startIndex={safeIndex}
        duration={effectiveDuration}
        loop={loop}
        showCaptions={showCaptions}
        showControls={showControls}
        showIndicators={showIndicators}
        dir={dir}
        labels={labels}
        reducedMotion={reducedMotion}
        className={className}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      data-rb="MorphSlider"
      data-morph-mode="webgl"
      data-morph-rendering={String(isRendering)}
      className={`morph-slider ${className}`.trim()}
      style={{
        '--ms-swap': `${(effectiveDuration * 0.66).toFixed(3)}s`,
        '--ms-dot': `${(effectiveDuration * 0.45).toFixed(3)}s`
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={e => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocusWithin(false);
      }}
      {...props}
    >
      <div
        ref={stageRef}
        className="morph-slider-stage"
        role="group"
        aria-roledescription="carousel"
        aria-label={labels.sliderLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {firstItem && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firstItem.image}
            alt={firstItem.alt || firstItem.caption || ''}
            className={`morph-slider-poster ${firstFrameReady ? 'is-hidden' : ''}`}
            decoding="async"
          />
        )}
      </div>

      <div aria-hidden="true" className="morph-slider-vignette" />

      {showCaptions && hasCaptions && (
        <div className="morph-slider-caption" aria-live="polite">
          {items.map((item, i) =>
            item.caption ? (
              <span
                key={`${item.caption}-${i}`}
                aria-hidden={i === safeIndex ? undefined : true}
                className={`morph-slider-caption-text ${i === safeIndex ? 'is-active' : ''}`}
              >
                <span className="morph-slider-caption-main">{item.caption}</span>
                {item.date ? <time className="morph-slider-caption-date">{item.date}</time> : null}
              </span>
            ) : null
          )}
        </div>
      )}

      {showControls && items.length > 1 && (
        <div className="morph-slider-controls">
          <button type="button" className="morph-slider-btn" aria-label={labels.previousSlide} onClick={handlePrev}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="rtl:rotate-180">
              <path
                d="M15 5l-7 7 7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button type="button" className="morph-slider-btn" aria-label={labels.nextSlide} onClick={handleNext}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="rtl:rotate-180">
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      {showIndicators && items.length > 1 && (
        <div className="morph-slider-indicators" role="tablist" aria-label={labels.slidesLabel}>
          {items.map((item, i) => (
            <button
              key={`${item.image}-dot-${i}`}
              type="button"
              role="tab"
              aria-selected={i === safeIndex}
              aria-label={labels.goToSlide.replace('{n}', String(i + 1))}
              className={`morph-slider-dot ${i === safeIndex ? 'is-active' : ''}`}
              onClick={() => {
                if (i !== safeIndex) handleGoToIndex(i);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
