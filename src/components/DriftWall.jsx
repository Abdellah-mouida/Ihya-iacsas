'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { SmoothImage } from '@/components/common/smooth-image';
import './DriftWall.css';

/**
 * @typedef {Object} DriftWallItem
 * @property {string} image
 * @property {string} [title]
 * @property {string} [href]
 * @property {number | null} [width]
 * @property {number | null} [height]
 * @property {number} [sourceIndex]
 */

/**
 * @typedef {Object} DriftWallProps
 * @property {DriftWallItem[]} [items]
 * @property {number} [columns]
 * @property {number} [tileWidth]
 * @property {number} [tileHeight]
 * @property {number} [gap]
 * @property {number} [radius]
 * @property {number} [tilt]
 * @property {number} [turn]
 * @property {number} [roll]
 * @property {number} [perspective]
 * @property {number} [depth]
 * @property {number} [speed]
 * @property {'up' | 'down'} [direction]
 * @property {number} [variance]
 * @property {number} [parallax]
 * @property {boolean} [pauseOnHover]
 * @property {number} [lift]
 * @property {number} [fade]
 * @property {number} [dim]
 * @property {boolean} [grayscale]
 * @property {string} [overlayColor]
 * @property {number} [seed]
 * @property {boolean} [lowPower]
 * @property {string} [ariaLabel]
 * @property {(item: DriftWallItem, sourceIndex: number) => void} [onItemClick]
 * @property {string} [className]
 * @property {import('react').CSSProperties} [style]
 */

/** @type {DriftWallItem[]} */
const DEFAULT_ITEMS = [];

const subscribeReducedMotion = (cb) => {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

const getReducedMotionSnapshot = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const subscribeVisibility = (cb) => {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
};

const getVisibilitySnapshot = () => (typeof document !== 'undefined' ? document.hidden : false);

const columnFactor = (index, variance) => {
  const pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
  return 1 + variance * pseudo;
};

const seededUnit = (seed, a, b) => {
  const x = Math.sin((seed + 1) * 12.9898 + (a + 1) * 78.233 + (b + 1) * 37.719) * 43758.5453;
  return x - Math.floor(x);
};

/** @param {DriftWallProps & Record<string, any>} props */
const DriftWall = ({
  items = DEFAULT_ITEMS,
  columns = 5,
  tileWidth = 210,
  tileHeight = 140,
  gap = 20,
  radius = 14,
  tilt = 16,
  turn = -14,
  roll = 0,
  perspective = 1200,
  depth = 120,
  speed = 42,
  direction = 'up',
  variance = 0.45,
  parallax = 0.6,
  pauseOnHover = false,
  lift = 64,
  fade = 0.58,
  dim = 0.84,
  grayscale = false,
  overlayColor = 'var(--background)',
  seed = 1,
  lowPower = false,
  ariaLabel = 'Drifting wall of tiles',
  onItemClick,
  className = '',
  style,
  ...rest
}) => {
  const containerRef = useRef(null);
  const planeRef = useRef(null);
  const trackRefs = useRef([]);
  const rafRef = useRef(null);

  const offsetsRef = useRef([]);
  const velocitiesRef = useRef([]);
  const hoveredColRef = useRef(-1);
  const wallHoveredRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const pointerDampedRef = useRef({ x: 0, y: 0 });
  const lastTsRef = useRef(null);

  const [containerHeight, setContainerHeight] = useState(600);
  const [activeId, setActiveId] = useState(null);
  const activeIdRef = useRef(null);
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
  const pageHidden = useSyncExternalStore(subscribeVisibility, getVisibilitySnapshot, () => false);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]) setInView(entries[0].isIntersecting);
      },
      { threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const columnItems = useMemo(() => {
    if (!items.length) return [];
    const indexed = items.map((item, idx) => ({
      ...item,
      sourceIndex: typeof item.sourceIndex === 'number' ? item.sourceIndex : idx,
    }));
    const cols = Array.from({ length: columns }, () => []);
    indexed.forEach((item, i) => cols[i % columns].push(item));

    const minPerCol = Math.max(4, Math.ceil(720 / Math.max(1, tileHeight + gap)));
    return cols.map((col, c) => {
      const base = col.length ? [...col] : [indexed[c % indexed.length]];
      if (base.length < minPerCol && indexed.length > 0) {
        let step = 0;
        while (base.length < minPerCol) {
          const pick = indexed[(c * 3 + step * 5 + Math.floor(seededUnit(seed, c, step) * indexed.length)) % indexed.length];
          base.push(pick);
          step += 1;
        }
      }
      return base;
    });
  }, [items, columns, tileHeight, gap, seed]);

  const columnMeta = useMemo(() => {
    const unit = tileHeight + gap;
    return columnItems.map((col) => {
      const copyHeight = Math.max(unit, col.length * unit);
      const baseCopies = lowPower || reduced ? 2 : Math.max(2, Math.ceil((containerHeight * 1.55) / copyHeight) + 1);
      return { copyHeight, copies: baseCopies };
    });
  }, [columnItems, tileHeight, gap, containerHeight, lowPower, reduced]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height || 600);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const baseVelocities = useMemo(() => {
    const dirSign = direction === 'up' ? 1 : -1;
    return columnItems.map((_, c) => {
      const altSign = c % 2 === 0 ? 1 : -1;
      return speed * columnFactor(c, variance) * dirSign * altSign;
    });
  }, [columnItems, speed, direction, variance]);

  const applyPlaneTransform = useCallback(
    (px, py) => {
      const plane = planeRef.current;
      if (!plane) return;
      plane.style.transform =
        `translate(-50%, -50%) scale(1.16) ` +
        `rotateX(${tilt + py}deg) rotateY(${turn + px}deg) rotateZ(${roll}deg) ` +
        `translateZ(${-depth}px)`;
    },
    [tilt, turn, roll, depth]
  );

  useLayoutEffect(() => {
    offsetsRef.current = columnMeta.map((meta, c) => {
      if (c === 0) return 0;
      const u = seededUnit(seed, c, 91);
      return meta.copyHeight * ((c * 0.37 + u * 0.5) % 1);
    });
    velocitiesRef.current = columnItems.map(() => 0);
    applyPlaneTransform(0, 0);
    for (let c = 0; c < trackRefs.current.length; c++) {
      const el = trackRefs.current[c];
      if (el) el.style.transform = `translate3d(0, ${-(offsetsRef.current[c] ?? 0)}px, 0)`;
    }
  }, [columnMeta, columnItems, seed, applyPlaneTransform]);

  const shouldAnimate = !reduced && !lowPower && inView && !pageHidden && columnItems.length > 0;

  useEffect(() => {
    if (!shouldAnimate) {
      applyPlaneTransform(0, 0);
      for (let c = 0; c < trackRefs.current.length; c++) {
        const el = trackRefs.current[c];
        const meta = columnMeta[c];
        if (el && meta) el.style.transform = `translate3d(0, ${-(offsetsRef.current[c] ?? 0)}px, 0)`;
      }
      return;
    }

    const animate = (ts) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.05, Math.max(0, ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      const maxTilt = parallax * 8;
      const targetX = pointerRef.current.x * maxTilt;
      const targetY = -pointerRef.current.y * maxTilt;
      const damp = 1 - Math.exp(-dt / 0.12);
      pointerDampedRef.current.x += (targetX - pointerDampedRef.current.x) * damp;
      pointerDampedRef.current.y += (targetY - pointerDampedRef.current.y) * damp;
      applyPlaneTransform(pointerDampedRef.current.x, pointerDampedRef.current.y);

      for (let c = 0; c < trackRefs.current.length; c++) {
        const meta = columnMeta[c];
        if (!meta) continue;
        const paused = wallHoveredRef.current && pauseOnHover;
        const factor = paused || hoveredColRef.current === c ? 0 : 1;
        const target = baseVelocities[c] * factor;

        const ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28));
        velocitiesRef.current[c] += (target - velocitiesRef.current[c]) * ease;
        let next = (offsetsRef.current[c] ?? 0) + velocitiesRef.current[c] * dt;
        next = ((next % meta.copyHeight) + meta.copyHeight) % meta.copyHeight;
        offsetsRef.current[c] = next;

        const el = trackRefs.current[c];
        if (el) el.style.transform = `translate3d(0, ${-next}px, 0)`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [shouldAnimate, baseVelocities, columnMeta, pauseOnHover, parallax, applyPlaneTransform]);

  const activate = useCallback((id, index) => {
    activeIdRef.current = id;
    hoveredColRef.current = index;
    setActiveId(id);
  }, []);
  const release = useCallback(() => {
    activeIdRef.current = null;
    hoveredColRef.current = -1;
    setActiveId(null);
  }, []);

  const handlePointerMove = useCallback(
    (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (parallax > 0 && !reduced && !lowPower) {
        pointerRef.current = {
          x: (e.clientX - rect.left) / rect.width - 0.5,
          y: (e.clientY - rect.top) / rect.height - 0.5,
        };
      }
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const tile = hit && hit.closest ? hit.closest('[data-tile-id]') : null;
      if (!tile) return;
      const id = tile.dataset.tileId;
      if (id === activeIdRef.current) return;
      activeIdRef.current = id;
      hoveredColRef.current = Number(tile.dataset.col);
      setActiveId(id);
    },
    [parallax, reduced, lowPower]
  );

  const handlePointerLeaveWall = useCallback(() => {
    wallHoveredRef.current = false;
    pointerRef.current = { x: 0, y: 0 };
    release();
  }, [release]);

  const cssVars = useMemo(
    () => ({
      '--dw-tile-w': `${tileWidth}px`,
      '--dw-tile-h': `${tileHeight}px`,
      '--dw-gap': `${gap}px`,
      '--dw-radius': `${radius}px`,
      '--dw-perspective': `${perspective}px`,
      '--dw-lift': `${lift}px`,
      '--dw-dim': dim,
      '--dw-gray': grayscale ? 1 : 0,
      '--dw-overlay': overlayColor,
      '--dw-edge': `${Math.max(0, (1 - fade) * 100)}%`,
      ...style,
    }),
    [tileWidth, tileHeight, gap, radius, perspective, lift, dim, grayscale, overlayColor, fade, style]
  );

  const renderTile = (item, id, colIndex, itemIndex) => {
    const jx = Math.round((seededUnit(seed, colIndex, itemIndex + 11) - 0.5) * 10);
    const jy = Math.round((seededUnit(seed, colIndex, itemIndex + 37) - 0.5) * 10);
    const rot = Number(((seededUnit(seed, colIndex, itemIndex + 73) - 0.5) * 4).toFixed(2));
    const innerStyle = {
      '--dw-jx': `${jx}px`,
      '--dw-jy': `${jy}px`,
      '--dw-rot': `${rot}deg`,
    };
    const inner = (
      <span className="drift-wall__inner" style={innerStyle}>
        <span className="drift-wall__media">
          <SmoothImage
            src={item.image}
            alt={item.title ?? ''}
            fill
            width={item.width ?? undefined}
            height={item.height ?? undefined}
            loading="eager"
            sizes="(max-width: 639px) 150px, 230px"
            draggable={false}
            containerClassName="h-full w-full"
            className="object-cover"
          />
        </span>
        <span className="drift-wall__overlay" aria-hidden="true" />
      </span>
    );
    const commonProps = {
      className: `drift-wall__tile${activeId === id ? ' is-active' : ''}`,
      'data-tile-id': id,
      'data-col': colIndex,
      'data-gallery-card': 'true',
      onFocus: () => activate(id, colIndex),
      onBlur: release,
    };
    if (item.href) {
      return (
        <a key={id} href={item.href} target="_blank" rel="noreferrer noopener" {...commonProps}>
          {inner}
        </a>
      );
    }
    return (
      <button
        key={id}
        type="button"
        aria-label={item.title ?? 'tile'}
        onClick={() => onItemClick?.(item, item.sourceIndex ?? 0)}
        {...commonProps}
      >
        {inner}
      </button>
    );
  };

  const rootClass = ['drift-wall', reduced ? 'drift-wall--reduced' : '', className].filter(Boolean).join(' ');

  return (
    <div
      ref={containerRef}
      className={rootClass}
      style={cssVars}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => {
        wallHoveredRef.current = true;
      }}
      onPointerLeave={handlePointerLeaveWall}
      role="group"
      aria-label={ariaLabel}
      {...rest}
    >
      <div ref={planeRef} className="drift-wall__plane">
        {columnItems.map((col, c) => {
          const meta = columnMeta[c];
          const copies = Array.from({ length: meta.copies });
          return (
            <div className="drift-wall__col" key={`col-${c}`}>
              <div
                className="drift-wall__track"
                ref={(el) => {
                  trackRefs.current[c] = el;
                }}
              >
                {copies.map((_, copyIndex) =>
                  col.map((item, itemIndex) => renderTile(item, `${c}-${copyIndex}-${itemIndex}`, c, itemIndex))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DriftWall;
