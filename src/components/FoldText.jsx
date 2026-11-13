'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './FoldText.css';

gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const HAS_ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const HINGES = {
  top: { origin: '50% 0%', axis: 'rotateX', sign: -1 },
  bottom: { origin: '50% 100%', axis: 'rotateX', sign: 1 },
  left: { origin: '0% 50%', axis: 'rotateY', sign: 1 },
  right: { origin: '100% 50%', axis: 'rotateY', sign: -1 }
};

const SLATS = {
  rotateX: {
    origins: ['50% 25%', '50% 75%'],
    clips: ['inset(-40% -20% 50% -20%)', 'inset(50% -20% -40% -20%)']
  },
  rotateY: {
    origins: ['25% 50%', '75% 50%'],
    clips: ['inset(-40% 50% -40% -20%)', 'inset(-40% -20% -40% 50%)']
  }
};

const FOLD_STYLES = ['paper', 'blinds', 'flip'];
const SLAT_DELAY = 0.24;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * @param {object} props
 * @param {import('react').ElementType} [props.as]
 * @param {string} [props.text]
 * @param {string} [props.ariaLabel]
 * @param {'char' | 'word' | 'line'} [props.splitBy]
 * @param {'top' | 'bottom' | 'left' | 'right'} [props.hinge]
 * @param {'paper' | 'blinds' | 'flip'} [props.foldStyle]
 * @param {number} [props.duration]
 * @param {number} [props.stagger]
 * @param {string} [props.staggerFrom]
 * @param {number} [props.foldAngle]
 * @param {string} [props.ease]
 * @param {number} [props.perspective]
 * @param {number} [props.creaseShading]
 * @param {'mount' | 'hover' | 'scroll' | 'loop'} [props.trigger]
 * @param {number} [props.loopDelay]
 * @param {boolean} [props.hoverRefold]
 * @param {number} [props.refoldRadius]
 * @param {number} [props.refoldAngle]
 * @param {number | string} [props.fontSize]
 * @param {number | string} [props.fontWeight]
 * @param {string} [props.color]
 * @param {[string, string] | null} [props.gradient]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.paused]
 * @param {(state: string) => void} [props.onStateChange]
 * @param {string} [props.wordTestId]
 * @param {string} [props.pieceTestId]
 * @param {string} [props.className]
 * @param {import('react').CSSProperties} [props.style]
 */
const FoldText = ({
  as: Component = 'span',
  text = 'Design unfolds',
  ariaLabel,
  splitBy = 'char',
  hinge = 'top',
  foldStyle = 'paper',
  duration = 0.65,
  stagger = 0.045,
  staggerFrom = 'start',
  foldAngle = 92,
  ease = 'power3.out',
  perspective = 700,
  creaseShading = 0.55,
  trigger = 'mount',
  loopDelay = 1.4,
  hoverRefold = false,
  refoldRadius = 140,
  refoldAngle = 45,
  fontSize = 'inherit',
  fontWeight = 'inherit',
  color = 'currentColor',
  gradient = null,
  disabled = false,
  paused = false,
  onStateChange,
  wordTestId,
  pieceTestId,
  className = '',
  style = {},
  ...rest
}) => {
  const rootRef = useRef(null);
  const timelineRef = useRef(null);
  const pausedRef = useRef(paused);
  const onStateChangeRef = useRef(onStateChange);

  useIsomorphicLayoutEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useIsomorphicLayoutEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  const safeHinge = HINGES[hinge] ? hinge : 'top';
  const hingeConfig = HINGES[safeHinge];
  const safeStyle = FOLD_STYLES.includes(foldStyle) ? foldStyle : 'paper';
  const safeCrease = clamp(creaseShading, 0, 1);
  const safeAngle = clamp(foldAngle, 0, 180);
  const safeStagger = Math.max(0, stagger);
  const safeDelay = Math.max(0, loopDelay);
  const safeRadius = Math.max(1, refoldRadius);
  const safeRefold = clamp(refoldAngle, 0, 180);
  const startsFolded = !disabled && trigger !== 'hover';
  const gradientStart = Array.isArray(gradient) ? gradient[0] : null;
  const gradientEnd = Array.isArray(gradient) ? gradient[1] : null;

  const segments = useMemo(() => {
    const tokens =
      splitBy === 'line'
        ? text.split('\n').map(line => ({ type: 'line', content: line || '\u00A0' }))
        : text.split(/(\s+)/).flatMap(part => {
            if (!part) return [];
            if (/^\s+$/.test(part)) return [{ type: 'space', content: part }];
            if (splitBy === 'word' || HAS_ARABIC_RE.test(part)) {
              return [{ type: 'word', pieces: [part] }];
            }
            return [{ type: 'word', pieces: Array.from(part) }];
          });

    const totalPieces = tokens.reduce(
      (sum, token) => sum + (token.type === 'space' ? 0 : token.type === 'line' ? 1 : token.pieces.length),
      0
    );

    let pieceCursor = 0;

    const renderPiece = (content, key, isLine = false) => {
      const index = pieceCursor++;
      const endPercent = Math.round((index / Math.max(totalPieces - 1, 1)) * 100);
      const pieceStyle =
        gradientStart && gradientEnd
          ? { color: `color-mix(in oklch, ${gradientStart} ${100 - endPercent}%, ${gradientEnd} ${endPercent}%)` }
          : undefined;

      return (
        <span className="fold-text-segment" data-fold-split={isLine ? 'line' : undefined} key={key}>
          {safeStyle === 'blinds' ? (
            <span
              className="fold-text-piece"
              data-fold-hinge={safeHinge}
              data-fold-style="blinds"
              data-fold-word=""
              data-testid={pieceTestId}
              style={pieceStyle}
            >
              <span className="fold-text-slat" data-fold-text={content}>
                {content}
              </span>
              <span className="fold-text-slat" data-fold-slat="b" data-fold-text={content}>
                {content}
              </span>
            </span>
          ) : (
            <span
              className="fold-text-piece"
              data-fold-hinge={safeHinge}
              data-fold-style={safeStyle}
              data-fold-text={content}
              data-fold-word=""
              data-testid={pieceTestId}
              style={pieceStyle}
            >
              {content}
            </span>
          )}
        </span>
      );
    };

    return tokens.flatMap((token, tokenIndex) => {
      if (token.type === 'line') {
        return [renderPiece(token.content, `line-${tokenIndex}`, true)];
      }
      if (token.type === 'space') {
        return token.content
          .split('\n')
          .flatMap((spaces, lineIndex) => [lineIndex > 0 ? <br key={`br-${tokenIndex}-${lineIndex}`} /> : null, spaces])
          .filter(Boolean);
      }
      return [
        <span className="fold-text-word" data-testid={wordTestId} key={`word-${tokenIndex}`}>
          {token.pieces.map((piece, charIndex) => renderPiece(piece, `piece-${tokenIndex}-${charIndex}`))}
        </span>
      ];
    });
  }, [text, splitBy, safeHinge, safeStyle, gradientStart, gradientEnd, wordTestId, pieceTestId]);

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const elements = Array.from(root.querySelectorAll('.fold-text-piece'));
    if (!elements.length) return undefined;

    const clearToStatic = () => {
      root.removeAttribute('data-fold-initial');
      elements.forEach(element => {
        element.style.transform = '';
        element.style.opacity = '1';
        element.style.removeProperty('--fold-crease');
      });
    };

    if (disabled) {
      clearToStatic();
      onStateChangeRef.current?.('static');
      return undefined;
    }

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (motionQuery?.matches) {
      clearToStatic();
      onStateChangeRef.current?.('static');
      const handleMotionChange = event => {
        if (!event.matches) return;
        clearToStatic();
      };
      motionQuery.addEventListener?.('change', handleMotionChange);
      return () => {
        motionQuery.removeEventListener?.('change', handleMotionChange);
      };
    }

    const { axis, sign, origin } = hingeConfig;
    const slats = SLATS[axis];
    const unfoldEase = gsap.parseEase(ease) || gsap.parseEase('power3.out');
    const foldEase = gsap.parseEase('power2.in');
    const angle = safeStyle === 'flip' ? 180 : safeAngle;
    const crease = safeCrease;
    const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
    const refold = hoverRefold && finePointer ? safeRefold : 0;
    const lift = safeStyle === 'flip' ? 0.45 : 0;

    const pieces = elements.map(element => {
      const parts = safeStyle === 'blinds' ? Array.from(element.children) : [element];
      if (safeStyle === 'blinds') {
        element.style.opacity = '1';
        parts.forEach((part, index) => {
          part.style.transformOrigin = slats.origins[index];
          if (index > 0) part.style.clipPath = slats.clips[index];
        });
      } else {
        element.style.transformOrigin = safeStyle === 'flip' ? '50% 50%' : origin;
        element.style.backfaceVisibility = safeStyle === 'flip' ? 'visible' : '';
      }
      return { element, parts, t: startsFolded ? 0 : 1, f: 0, r: 0, aim: 0 };
    });

    const shade = (progress, tilt) => String(crease * clamp(1 - progress + tilt / 90, 0, 1));

    const render = () => {
      pieces.forEach(piece => {
        const tilt = piece.r * refold;

        if (safeStyle === 'blinds') {
          let resting = tilt < 0.05;
          piece.parts.forEach((part, index) => {
            const offset = index * SLAT_DELAY;
            const open = unfoldEase(clamp((piece.t - offset) / (1 - SLAT_DELAY), 0, 1));
            const close = foldEase(clamp((piece.f - offset) / (1 - SLAT_DELAY), 0, 1));
            const progress = open * (1 - close);
            if (Math.abs(1 - progress) > 0.002) resting = false;
            part.style.transform = `${axis}(${sign * ((1 - progress) * angle + tilt)}deg)`;
            part.style.opacity = String(clamp(progress, 0, 1));
            part.style.setProperty('--fold-crease', shade(progress, tilt));
          });
          piece.parts[0].style.clipPath = resting ? 'none' : slats.clips[0];
          piece.parts[1].style.visibility = resting ? 'hidden' : 'visible';
          return;
        }

        const progress = unfoldEase(piece.t) * (1 - foldEase(piece.f));
        if (Math.abs(1 - progress) < 0.0005 && Math.abs(tilt) < 0.0005) {
          piece.element.style.transform = '';
          piece.element.style.opacity = '1';
          piece.element.style.setProperty('--fold-crease', '0');
          return;
        }
        const rise = lift * Math.sin(Math.PI * clamp(progress, 0, 1));
        const turn = `${axis}(${sign * ((1 - progress) * angle + tilt)}deg)`;
        piece.element.style.transform = rise > 0.001 ? `translateZ(${rise}em) ${turn}` : turn;
        piece.element.style.opacity = String(clamp(progress, 0, 1));
        piece.element.style.setProperty('--fold-crease', shade(progress, tilt));
      });
    };

    let timeline = null;
    let scrollTrigger = null;
    let cancelled = false;
    let fontFallbackTimer = null;
    let failsafeTimer = null;

    const play = loop => {
      timeline?.kill();
      timeline = gsap.timeline({
        paused: pausedRef.current,
        onUpdate: render,
        ...(loop ? { repeat: -1, repeatDelay: 0.35 } : {})
      });
      timeline.fromTo(
        pieces,
        { t: 0, f: 0 },
        { t: 1, duration, ease: 'none', stagger: { each: safeStagger, from: staggerFrom } }
      );
      if (loop) {
        timeline.to(
          pieces,
          { f: 1, duration: duration * 0.75, ease: 'none', stagger: { each: safeStagger, from: staggerFrom } },
          `+=${safeDelay}`
        );
      }
      timelineRef.current = timeline;
      onStateChangeRef.current?.('ready');
      render();
    };

    const handleEnter = () => play(false);

    if (trigger === 'hover') {
      root.setAttribute('data-fold-started', 'true');
      root.removeAttribute('data-fold-initial');
      render();
      onStateChangeRef.current?.('ready');
      root.addEventListener('mouseenter', handleEnter);
    } else if (trigger === 'scroll') {
      root.setAttribute('data-fold-started', 'true');
      root.removeAttribute('data-fold-initial');
      render();
      scrollTrigger = ScrollTrigger.create({
        trigger: root,
        start: 'top 82%',
        once: true,
        onEnter: handleEnter
      });
    } else {
      let started = false;
      const startFold = () => {
        if (started || cancelled) return;
        started = true;
        if (fontFallbackTimer) window.clearTimeout(fontFallbackTimer);
        if (failsafeTimer) window.clearTimeout(failsafeTimer);
        root.setAttribute('data-fold-started', 'true');
        play(trigger === 'loop');
        root.removeAttribute('data-fold-initial');
      };

      failsafeTimer = window.setTimeout(() => {
        if (!started && !cancelled) {
          clearToStatic();
          onStateChangeRef.current?.('static');
        }
      }, 2000);

      const fontsReady = document.fonts?.ready;
      if (fontsReady && typeof fontsReady.then === 'function') {
        fontFallbackTimer = window.setTimeout(startFold, 600);
        fontsReady.then(startFold, startFold);
      } else {
        startFold();
      }
    }

    let pointer = null;
    let centers = null;
    let measured = null;
    let relaxing = false;

    const measure = box => {
      centers = pieces.map(piece => {
        const rect = piece.element.parentElement.getBoundingClientRect();
        return { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2 };
      });
      measured = { width: box.width, height: box.height };
    };

    const relax = (_time, deltaTime) => {
      const step = Math.min(deltaTime, 64) / 1000;
      let moving = false;
      pieces.forEach(piece => {
        const rate = piece.aim > piece.r ? 14 : 6;
        piece.r += (piece.aim - piece.r) * (1 - Math.exp(-rate * step));
        if (Math.abs(piece.aim - piece.r) > 0.001) moving = true;
        else piece.r = piece.aim;
      });
      render();
      if (!moving) {
        gsap.ticker.remove(relax);
        relaxing = false;
      }
    };

    const aim = () => {
      const box = root.getBoundingClientRect();
      const near =
        pointer &&
        pointer.x > box.left - safeRadius &&
        pointer.x < box.right + safeRadius &&
        pointer.y > box.top - safeRadius &&
        pointer.y < box.bottom + safeRadius;
      if (near && (!centers || Math.abs(box.width - measured.width) + Math.abs(box.height - measured.height) > 1)) {
        measure(box);
      }
      let changed = false;
      pieces.forEach((piece, index) => {
        let value = 0;
        if (near) {
          const center = centers[index];
          const distance = Math.hypot(box.left + center.x - pointer.x, box.top + center.y - pointer.y) / safeRadius;
          if (distance < 1) value = 1 - distance * distance * (3 - 2 * distance);
        }
        if (value !== piece.aim) changed = true;
        piece.aim = value;
      });
      if (changed && !relaxing) {
        relaxing = true;
        gsap.ticker.add(relax);
      }
    };

    const handleMove = event => {
      pointer = { x: event.clientX, y: event.clientY };
      aim();
    };

    const handleLeave = () => {
      pointer = null;
      aim();
    };

    const handleScroll = () => {
      if (pointer) aim();
    };

    if (refold) {
      window.addEventListener('pointermove', handleMove, { passive: true });
      window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
      document.documentElement.addEventListener('pointerleave', handleLeave);
    }

    const handleMotionChange = event => {
      if (!event.matches) return;
      timeline?.kill();
      timeline = null;
      timelineRef.current = null;
      gsap.ticker.remove(relax);
      relaxing = false;
      clearToStatic();
      onStateChangeRef.current?.('static');
    };
    motionQuery?.addEventListener?.('change', handleMotionChange);

    return () => {
      cancelled = true;
      if (fontFallbackTimer) window.clearTimeout(fontFallbackTimer);
      if (failsafeTimer) window.clearTimeout(failsafeTimer);
      root.removeEventListener('mouseenter', handleEnter);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('scroll', handleScroll, { capture: true });
      document.documentElement.removeEventListener('pointerleave', handleLeave);
      motionQuery?.removeEventListener?.('change', handleMotionChange);
      gsap.ticker.remove(relax);
      scrollTrigger?.kill();
      timeline?.kill();
      timelineRef.current = null;
      gsap.killTweensOf(pieces);
    };
  }, [
    segments,
    hingeConfig,
    safeStyle,
    duration,
    safeStagger,
    staggerFrom,
    safeAngle,
    ease,
    safeCrease,
    trigger,
    safeDelay,
    hoverRefold,
    safeRadius,
    safeRefold,
    startsFolded,
    disabled
  ]);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline || disabled) return;
    if (paused) timeline.pause();
    else timeline.resume();
  }, [paused, disabled]);

  const rootStyle = {
    ...(fontSize != null && fontSize !== 'inherit'
      ? { '--fold-text-font-size': typeof fontSize === 'number' ? `${fontSize}px` : fontSize }
      : null),
    ...(fontWeight != null && fontWeight !== 'inherit' ? { '--fold-text-font-weight': fontWeight } : null),
    ...(color && color !== 'currentColor' ? { '--fold-text-color': color } : null),
    '--fold-perspective': `${Math.max(120, perspective)}px`,
    ...style
  };

  return (
    <Component
      ref={rootRef}
      aria-label={ariaLabel}
      data-fold-initial={startsFolded ? 'folded' : undefined}
      className={`fold-text ${className}`.trim()}
      style={rootStyle}
      {...rest}
    >
      {!ariaLabel ? <span className="fold-text-sr-only">{text}</span> : null}
      <span className="fold-text-visual" aria-hidden="true">
        {segments}
      </span>
    </Component>
  );
};

export default FoldText;
