/**
 * Phaser Matter Plinko scene factory.
 * Phaser is imported dynamically so Node/SSR never evaluates the browser bundle.
 */
import { DEMO_BIN_WEIGHTS, pickBinIndex } from "@/lib/bin-odds";
import { DEFAULT_MULTIPLIERS } from "@/lib/multipliers";
import {
  guideEnvelopeXAtY,
  triangleGuideEndpoints,
  trianglePegCounts,
  trianglePegPositions,
} from "@/lib/peg-layout";
import type { DropResult, PlinkoGameApi } from "@/game/types";
import { MAX_CONCURRENT_BALLS } from "@/lib/ball-count";
import { playDrop, playLandForMultiplier, playPegHit } from "@/lib/sfx";

export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 520;

/** Classic Galton start: row 0 has 3 pegs; grows to binCount-1. */
export const TRIANGLE_START_PEGS = 3;

type MatterBody = {
  label?: string;
  position?: { x: number; y: number };
  gameObject?: { destroy: () => void };
};

type PendingDrop = {
  resolve: (result: DropResult) => void;
  reject: (err: Error) => void;
  ballId: number;
  /** Settlement bin — physics is visual guidance only. */
  targetBin: number;
  timeoutId: ReturnType<typeof setTimeout>;
};

type MatterBodyWithMotion = MatterBody & {
  velocity?: { x: number; y: number };
  _cleanupGlow?: () => void;
  _targetBin?: number;
};

function hashToUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function formatMult(m: number): string {
  return `${m}x`;
}

function binColor(mult: number): number {
  if (mult >= 100) return 0xf59e0b;
  if (mult >= 20) return 0xb91c1c;
  if (mult >= 8) return 0xef4444;
  if (mult >= 4) return 0xf97316;
  if (mult >= 2) return 0xfbbf24;
  if (mult >= 1) return 0x2dd4bf;
  return 0x52525b;
}

export type CreatePlinkoGameOptions = {
  multipliers?: number[];
  /** Settlement weights (same length as multipliers). Defaults to DEMO_BIN_WEIGHTS. */
  binWeights?: number[];
  width?: number;
  height?: number;
  /** Optional land celebration callback (React juice listens via DropResult too). */
  onLandJuice?: (result: DropResult) => void;
};

/**
 * Boot a Phaser game into `parent` and return an imperative API.
 * Must only be called in the browser (`window` present).
 */
export async function createPlinkoGame(
  parent: HTMLElement,
  options: CreatePlinkoGameOptions = {},
): Promise<PlinkoGameApi> {
  if (typeof window === "undefined") {
    throw new Error("createPlinkoGame requires a browser environment");
  }

  const Phaser = (await import("phaser")).default;

  const width = options.width ?? BOARD_WIDTH;
  const height = options.height ?? BOARD_HEIGHT;
  let multipliers = [...(options.multipliers ?? DEFAULT_MULTIPLIERS)];
  let binWeights = [...(options.binWeights ?? DEMO_BIN_WEIGHTS)];
  if (binWeights.length !== multipliers.length) {
    throw new Error("binWeights length must match multipliers");
  }
  const binCount = multipliers.length;
  const onLandJuice = options.onLandJuice;

  let speedScale = 1;
  let nextBallId = 1;
  const pending = new Map<number, PendingDrop>();
  /** Concurrent in-flight balls (BUY ×N); capped to avoid physics meltdown. */
  let activeBalls = 0;

  // Peg spacing for spawn jitter (set in createPegs).
  let pegSpacing = width / (binCount + 1);
  /** Triangle rail endpoints — used to clamp balls inside the pyramid. */
  let guideEndpoints: ReturnType<typeof triangleGuideEndpoints> | null = null;
  const BIN_TOP = height - 100;

  type SceneApi = {
    applySpeed: (speed: number) => void;
    spawnBall: (
      ballId: number,
      seed: string | undefined,
      targetBin: number,
      onTimeout: (body: MatterBody) => void,
    ) => MatterBody;
    removeBall: (body: MatterBody) => void;
    celebrateBin: (binIndex: number, mult: number) => void;
  };

  let sceneApi: SceneApi | null = null;

  class PlinkoScene extends Phaser.Scene {
    private pegCategory = 0;
    private ballCategory = 0;
    private binCategory = 0;

    constructor() {
      super({ key: "Plinko" });
    }

    create() {
      const matter = this.matter;

      this.pegCategory = matter.world.nextCategory();
      this.ballCategory = matter.world.nextCategory();
      this.binCategory = matter.world.nextCategory();

      matter.world.setGravity(0, 1.35);
      this.applySpeed(speedScale);

      this.drawJapaneseBackdrop();
      this.createWalls();
      this.createPegs();
      this.createBins();

      matter.world.on(
        "collisionstart",
        (event: { pairs: Array<{ bodyA: MatterBody; bodyB: MatterBody }> }) => {
          for (const pair of event.pairs) {
            this.handlePair(pair.bodyA, pair.bodyB);
          }
        },
      );

      sceneApi = {
        applySpeed: (s) => this.applySpeed(s),
        spawnBall: (id, seed, targetBin, onTimeout) =>
          this.spawnBall(id, seed, targetBin, onTimeout),
        removeBall: (body) => this.removeBall(body),
        celebrateBin: (binIndex, mult) => this.celebrateBin(binIndex, mult),
      };
    }

    applySpeed(speed: number) {
      speedScale = speed;
      this.time.timeScale = speed;
      const engine = this.matter.world.engine as { timing: { timeScale: number } };
      engine.timing.timeScale = speed;
    }

    private drawJapaneseBackdrop() {
      const g = this.add.graphics();
      // L0 — darker vertical gradient (top → mid → bottom)
      g.fillGradientStyle(0x1a1020, 0x1a1020, 0x120e18, 0x120e18, 1);
      g.fillRect(0, 0, width, height / 2);
      g.fillGradientStyle(0x120e18, 0x120e18, 0x0a0810, 0x0a0810, 1);
      g.fillRect(0, height / 2 - 1, width, height / 2 + 1);

      // L1 — tighter sakura / accent bokeh (don't steal focus from pegs)
      g.fillStyle(0xffb7c5, 0.16);
      g.fillCircle(width * 0.18, height * 0.12, 100);
      g.fillStyle(0xffb7c5, 0.1);
      g.fillCircle(width * 0.88, height * 0.18, 70);
      g.fillStyle(0xc8f542, 0.045);
      g.fillCircle(width * 0.5, height * 0.55, 120);

      // L2 — faint horizontal grid hint (mid pyramid only)
      g.lineStyle(1, 0xffffff, 0.02);
      for (let y = height * 0.18; y < height * 0.62; y += 28) {
        g.lineBetween(36, y, width - 36, y);
      }

      // L3 — top / bottom vignette
      g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.25, 0.25, 0, 0);
      g.fillRect(0, 0, width, 48);
      g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.25, 0.25);
      g.fillRect(0, height - 48, width, 48);

      g.setDepth(-10);
    }

    private createWalls() {
      const wallOpts = {
        isStatic: true,
        label: "wall",
        friction: 0.05,
        restitution: 0.35,
        collisionFilter: {
          category: this.pegCategory,
          mask: this.ballCategory,
        },
      };
      const thickness = 24;
      // Safety outer walls (far from triangle gutters)
      this.matter.add.rectangle(-thickness / 2, height / 2, thickness, height, wallOpts);
      this.matter.add.rectangle(width + thickness / 2, height / 2, thickness, height, wallOpts);
      this.matter.add.rectangle(width / 2, height + 10, width + 40, 24, {
        ...wallOpts,
        label: "floor",
      });
    }

    private createSlantGuides(
      left: [{ x: number; y: number }, { x: number; y: number }],
      right: [{ x: number; y: number }, { x: number; y: number }],
    ) {
      const addSegment = (
        a: { x: number; y: number },
        b: { x: number; y: number },
        label: string,
        thickness: number,
      ) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        this.matter.add.rectangle(cx, cy, len, thickness, {
          isStatic: true,
          label,
          angle,
          friction: 0.12,
          restitution: 0.25,
          collisionFilter: {
            category: this.pegCategory,
            mask: this.ballCategory,
          },
        });
      };

      // Thick primary rails + slightly outer backup to stop tunneling.
      addSegment(left[0], left[1], "guide-left", 14);
      addSegment(right[0], right[1], "guide-right", 14);
      const outward = 8;
      addSegment(
        { x: left[0].x - outward, y: left[0].y },
        { x: left[1].x - outward, y: left[1].y },
        "guide-left-outer",
        10,
      );
      addSegment(
        { x: right[0].x + outward, y: right[0].y },
        { x: right[1].x + outward, y: right[1].y },
        "guide-right-outer",
        10,
      );

      // Visual rails: outer sakura glow → accent main → inner white highlight
      const g = this.add.graphics();
      g.lineStyle(10, 0xffb7c5, 0.12);
      g.lineBetween(left[0].x, left[0].y, left[1].x, left[1].y);
      g.lineBetween(right[0].x, right[0].y, right[1].x, right[1].y);
      g.lineStyle(3, 0xc8f542, 0.55);
      g.lineBetween(left[0].x, left[0].y, left[1].x, left[1].y);
      g.lineBetween(right[0].x, right[0].y, right[1].x, right[1].y);
      // Inner highlight (~1px toward board center)
      g.lineStyle(1.25, 0xffffff, 0.35);
      g.lineBetween(left[0].x + 1, left[0].y, left[1].x + 1, left[1].y);
      g.lineBetween(right[0].x - 1, right[0].y, right[1].x - 1, right[1].y);
      // Top crown — drop mouth between rail apexes
      g.lineStyle(2, 0xc8f542, 0.4);
      g.lineBetween(left[0].x, left[0].y, right[0].x, right[0].y);
      // Bottom brackets where rails meet the multiplier shelf
      g.fillStyle(0xc8f542, 0.2);
      g.fillRoundedRect(left[1].x - 5, left[1].y - 2, 10, 6, 2);
      g.fillRoundedRect(right[1].x - 5, right[1].y - 2, 10, 6, 2);
      g.setDepth(-1);
    }

    /** Visual peg containers for collision scale-punch (physics radii unchanged). */
    private pegFx: Array<{
      x: number;
      y: number;
      container: Phaser.GameObjects.Container;
      halo: Phaser.GameObjects.Arc;
    }> = [];

    private punchPegAt(x: number, y: number) {
      let best: (typeof this.pegFx)[number] | null = null;
      let bestD = 14;
      for (const peg of this.pegFx) {
        const d = Math.hypot(peg.x - x, peg.y - y);
        if (d < bestD) {
          bestD = d;
          best = peg;
        }
      }
      if (!best) return;
      this.tweens.killTweensOf(best.container);
      this.tweens.killTweensOf(best.halo);
      best.container.setScale(1);
      best.halo.setAlpha(0.14);
      this.tweens.add({
        targets: best.container,
        scale: 1.25,
        duration: 40,
        yoyo: true,
        ease: "Quad.easeOut",
      });
      this.tweens.add({
        targets: best.halo,
        alpha: 0.32,
        duration: 40,
        yoyo: true,
        onComplete: () => {
          if (best?.halo.active) best.halo.setAlpha(0.14);
        },
      });
    }

    private createPegs() {
      const topY = 52;
      const bottomY = height - 132;
      const pegRadius = 4.2;
      const marginX = 30;
      this.pegFx = [];

      const counts = trianglePegCounts(binCount, TRIANGLE_START_PEGS);
      const points = trianglePegPositions({
        binCount,
        width,
        topY,
        bottomY,
        marginX,
        startPegs: TRIANGLE_START_PEGS,
      });
      const guides = triangleGuideEndpoints({
        binCount,
        width,
        topY,
        bottomY,
        marginX,
        startPegs: TRIANGLE_START_PEGS,
        // Small pad + thick rails → gutters shrink; ball stays in pyramid.
        pad: 2,
        extendTop: 22,
        extendBottom: 28,
      });
      pegSpacing = guides.spacing;
      guideEndpoints = guides;

      this.createSlantGuides(guides.left, guides.right);

      // Faint pyramid fill behind pegs (alpha lowered so pegs read clearer)
      const fill = this.add.graphics();
      fill.fillStyle(0xc8f542, 0.02);
      fill.fillTriangle(
        guides.left[0].x,
        guides.left[0].y,
        guides.right[0].x,
        guides.right[0].y,
        width / 2,
        bottomY + 40,
      );
      fill.fillStyle(0xffb7c5, 0.02);
      fill.fillTriangle(
        guides.left[1].x,
        guides.left[1].y,
        guides.right[1].x,
        guides.right[1].y,
        width / 2,
        topY - 20,
      );
      fill.setDepth(-5);

      for (const p of points) {
        this.matter.add.circle(p.x, p.y, pegRadius, {
          isStatic: true,
          label: "peg",
          friction: 0.05,
          restitution: 0.55,
          collisionFilter: {
            category: this.pegCategory,
            mask: this.ballCategory,
          },
        });
        // Three-layer peg: sakura halo + metal ring + ivory core (physics r unchanged)
        const halo = this.add.circle(0, 0, pegRadius + 5, 0xffb7c5, 0.14);
        const ring = this.add.circle(0, 0, pegRadius + 1.2, 0x3a3228, 0.85);
        ring.setStrokeStyle(1.4, 0xe8c48a, 0.9);
        const core = this.add.circle(0, 0, Math.max(1.5, pegRadius - 0.6), 0xf5e6c8, 1);
        const highlight = this.add.circle(0, -1.4, Math.max(0.8, pegRadius - 2.4), 0xffffff, 0.55);
        const container = this.add.container(p.x, p.y, [halo, ring, core, highlight]);
        container.setDepth(1);
        this.pegFx.push({ x: p.x, y: p.y, container, halo });
      }

      // Document row shape for debugging overlays (invisible)
      void counts;
    }

    private binRects: Array<{
      rect: {
        x: number;
        y: number;
        active: boolean;
        setFillStyle: (c: number, a: number) => void;
        setStrokeStyle: (w: number, c: number, a: number) => void;
        setScale: (x: number, y?: number) => void;
      };
      baseColor: number;
      mult: number;
    }> = [];

    private createBins() {
      const binTop = height - 100;
      const binHeight = 72;
      const binW = width / binCount;
      this.binRects = [];

      // Soft shelf under bins — top accent highlight + bottom inner shadow
      const shelf = this.add.graphics();
      shelf.fillStyle(0x0a0a0e, 0.55);
      shelf.fillRoundedRect(4, binTop - 4, width - 8, binHeight + 10, 10);
      shelf.lineStyle(1, 0xc8f542, 0.25);
      shelf.lineBetween(10, binTop - 4, width - 10, binTop - 4);
      shelf.fillStyle(0x000000, 0.35);
      shelf.fillRect(8, binTop + binHeight - 2, width - 16, 6);
      shelf.setDepth(0);

      for (let i = 0; i < binCount; i++) {
        const cx = binW * i + binW / 2;
        const mult = multipliers[i] ?? 1;

        if (i > 0) {
          this.matter.add.rectangle(binW * i, binTop + binHeight / 2, 3, binHeight, {
            isStatic: true,
            label: "divider",
            friction: 0.2,
            restitution: 0.1,
            collisionFilter: {
              category: this.pegCategory,
              mask: this.ballCategory,
            },
          });
        }

        this.matter.add.rectangle(cx, binTop + binHeight / 2, binW - 2, binHeight - 4, {
          isStatic: true,
          isSensor: true,
          label: `bin-${i}`,
          collisionFilter: {
            category: this.binCategory,
            mask: this.ballCategory,
          },
        });

        const color = binColor(mult);
        const chipW = Math.max(binW - 3, 10);
        const chipH = binHeight - 10;
        const cy = binTop + binHeight / 2;

        // Outer glow for high multipliers (≥20)
        if (mult >= 20) {
          const glow = this.add.rectangle(cx, cy, chipW + 5, chipH + 5, color, 0.2);
          glow.setDepth(1);
        }

        // Chip fill alpha 0.72 (was 0.42) + fake bevel via bright top / dim sides
        const rect = this.add.rectangle(cx, cy, chipW, chipH, color, 0.72);
        rect.setStrokeStyle(1.5, color, 0.55);
        rect.setDepth(2);
        // Bright top edge (fake bevel)
        const bevel = this.add.rectangle(cx, cy - chipH / 2 + 1, chipW - 2, 2, color, 1);
        bevel.setDepth(2.5);

        this.binRects.push({ rect, baseColor: color, mult });
        const label = this.add
          .text(cx, cy, formatMult(mult), {
            fontSize: binCount > 12 ? "9px" : "11px",
            color: "#fafafa",
            fontStyle: "bold",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          })
          .setOrigin(0.5)
          .setDepth(3);
        label.setShadow(0, 1, "#000000", 0, false, true);
        label.setAlpha(1);
      }
    }

    /** Brief flash + spark burst on the settled bin. */
    celebrateBin(binIndex: number, mult: number) {
      const entry = this.binRects[binIndex];
      if (!entry) return;
      const { rect, baseColor } = entry;
      const flashColor = mult >= 100 ? 0xffe566 : mult >= 15 ? 0xfff1a8 : 0xc8f542;
      rect.setFillStyle(flashColor, 0.95);
      if (mult >= 100) {
        rect.setStrokeStyle(2, 0xffe566, 1);
      } else {
        rect.setStrokeStyle(2.5, 0xffffff, 1);
      }
      this.tweens.add({
        targets: rect,
        scaleX: 1.18,
        scaleY: 1.18,
        duration: 120,
        yoyo: true,
        ease: "Quad.easeOut",
        onComplete: () => {
          if (!rect.active) return;
          rect.setScale(1);
          // Settle to chip resting alpha 0.72 (not the old 0.42)
          rect.setFillStyle(baseColor, 0.72);
          rect.setStrokeStyle(1.5, baseColor, 0.55);
        },
      });

      // Lightweight particle burst (circles)
      const cx = rect.x;
      const cy = rect.y;
      const n = mult >= 100 ? 14 : mult >= 15 ? 14 : mult >= 3 ? 8 : 0;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const dist = 18 + Math.random() * 28;
        const dot = this.add.circle(cx, cy, 2 + Math.random() * 2.5, flashColor, 0.95);
        dot.setDepth(20);
        this.tweens.add({
          targets: dot,
          x: cx + Math.cos(ang) * dist,
          y: cy + Math.sin(ang) * dist - 10,
          alpha: 0,
          scale: 0.2,
          duration: 320 + Math.random() * 180,
          ease: "Quad.easeOut",
          onComplete: () => dot.destroy(),
        });
      }
    }

    private handlePair(a: MatterBody, b: MatterBody) {
      const labels = [a.label, b.label];
      const ballBody = [a, b].find((body) => body.label?.startsWith("ball-"));

      // Peg (and guide) ticks — throttled inside playPegHit for multi-ball.
      const pegBody = [a, b].find((body) => body.label === "peg");
      const hitGuide = labels.some(
        (l) => typeof l === "string" && l.startsWith("guide-"),
      );
      if ((pegBody || hitGuide) && ballBody) {
        playPegHit();
      }
      // Visual-only peg punch (physics restitution unchanged)
      if (pegBody?.position && ballBody) {
        this.punchPegAt(pegBody.position.x, pegBody.position.y);
      }

      const binLabel = labels.find((l) => typeof l === "string" && l.startsWith("bin-"));
      if (!binLabel) return;
      if (!ballBody || !ballBody.label) return;

      const ballId = Number(ballBody.label.slice(5));
      // Always settle on the pre-chosen target (weighted odds), not the sensor.
      finishDrop(ballId, ballBody);
    }

    spawnBall(
      ballId: number,
      seed: string | undefined,
      targetBin: number,
      onTimeout: (body: MatterBody) => void,
    ): MatterBody {
      const unit = seed ? hashToUnit(seed) : Math.random();
      const binW = width / binCount;
      const targetX = (targetBin + 0.5) * binW;
      // Spawn near apex, biased toward the chosen bin so guidance looks natural.
      const topSpread = Math.min(pegSpacing * 0.9, width * 0.1);
      const apex = width / 2;
      const radius = 6.5;
      const spawnY = 26;
      let startX =
        apex +
        (targetX - apex) * 0.28 +
        (unit - 0.5) * topSpread +
        (Math.random() - 0.5) * Math.min(pegSpacing * 0.35, 10);
      // Keep spawn strictly inside the triangle envelope at the apex.
      if (guideEndpoints) {
        const env = guideEnvelopeXAtY(guideEndpoints, spawnY);
        const inset = radius + 3;
        startX = Math.min(env.rightX - inset, Math.max(env.leftX + inset, startX));
      }

      // Outer glow (stronger) + lime core
      const glow = this.add.circle(startX, spawnY, radius + 6, 0xc8f542, 0.32);
      glow.setDepth(4);
      const visual = this.add.circle(startX, spawnY, radius, 0xe8ff8a, 1);
      visual.setStrokeStyle(1.5, 0xffffff, 0.75);
      visual.setDepth(5);

      this.matter.add.gameObject(visual, {
        shape: { type: "circle", radius },
        label: `ball-${ballId}`,
        restitution: 0.45,
        friction: 0.02,
        frictionAir: 0.01,
        density: 0.002,
        collisionFilter: {
          category: this.ballCategory,
          mask: this.pegCategory | this.binCategory,
        },
      });

      const body = (visual as unknown as { body: MatterBodyWithMotion }).body;
      body._targetBin = targetBin;

      const matterBodyApi = this.matter.body as unknown as {
        setVelocity: (
          b: MatterBody,
          velocity: { x: number; y: number },
        ) => void;
        setPosition: (
          b: MatterBody,
          position: { x: number; y: number },
        ) => void;
      };

      // Lime trail ghosts (max 8); keep glow glued + steer toward target bin.
      const trails: Phaser.GameObjects.Arc[] = [];
      let trailFrame = 0;
      const follow = () => {
        if (!body?.position || !glow.active) return;
        let x = body.position.x;
        const y = body.position.y;
        let vx = body.velocity?.x ?? 0;
        const vy = body.velocity?.y ?? 0;

        if (guideEndpoints && y < BIN_TOP - 6) {
          const env = guideEnvelopeXAtY(guideEndpoints, y);
          const inset = radius + 2;
          const minX = env.leftX + inset;
          const maxX = env.rightX - inset;
          if (x < minX) {
            x = minX;
            vx = Math.abs(vx) * 0.25 + 0.4;
            matterBodyApi.setPosition(body, { x, y });
          } else if (x > maxX) {
            x = maxX;
            vx = -Math.abs(vx) * 0.25 - 0.4;
            matterBodyApi.setPosition(body, { x, y });
          } else {
            // Soft inward pull when near the rail so gutters never look empty.
            const edgeZone = Math.max(8, pegSpacing * 0.35);
            if (x - minX < edgeZone) {
              vx += 0.35;
            } else if (maxX - x < edgeZone) {
              vx -= 0.35;
            }
          }
        }

        glow.setPosition(x, y);

        // Short lime trail every 2–3 frames (cap 8 ghosts for perf)
        trailFrame += 1;
        if (trailFrame % 3 === 0) {
          while (trails.length >= 8) {
            const old = trails.shift();
            if (old?.active) old.destroy();
          }
          const ghost = this.add.circle(x, y, radius * 0.7, 0xc8f542, 0.35);
          ghost.setDepth(4);
          trails.push(ghost);
          this.tweens.add({
            targets: ghost,
            alpha: 0,
            scale: 0.4,
            duration: 240,
            ease: "Quad.easeOut",
            onComplete: () => {
              const idx = trails.indexOf(ghost);
              if (idx >= 0) trails.splice(idx, 1);
              if (ghost.active) ghost.destroy();
            },
          });
        }

        // Near shelf: brief squash before bin celebrate
        if (y > BIN_TOP - 18 && y < BIN_TOP + 8 && visual.active) {
          visual.setScale(1, 0.85);
        } else if (visual.active) {
          visual.setScale(1, 1);
        }

        const dx = targetX - x;
        // Mild horizontal pull; clamp so peg bounces still read as physics.
        const steer = Math.max(-2.8, Math.min(2.8, dx * 0.045));
        const newVx = vx * 0.88 + steer;
        matterBodyApi.setVelocity(body, { x: newVx, y: vy });
      };
      this.events.on("update", follow);
      const cleanupGlow = () => {
        this.events.off("update", follow);
        if (glow.active) glow.destroy();
        for (const t of trails) {
          if (t.active) t.destroy();
        }
        trails.length = 0;
      };
      body._cleanupGlow = cleanupGlow;

      const timeoutMs = Math.max(4000, 12000 / Math.max(speedScale, 0.5));
      const timeoutId = setTimeout(() => {
        onTimeout(body);
      }, timeoutMs);

      const entry = pending.get(ballId);
      if (entry) entry.timeoutId = timeoutId;

      playDrop();
      return body;
    }

    removeBall(body: MatterBody) {
      try {
        const withGlow = body as MatterBodyWithMotion;
        withGlow._cleanupGlow?.();
        if (body.gameObject) body.gameObject.destroy();
        else this.matter.world.remove(body as never);
      } catch {
        // already removed
      }
    }
  }

  function finishDrop(ballId: number, ballBody?: MatterBody) {
    const entry = pending.get(ballId);
    if (!entry) return;
    pending.delete(ballId);
    clearTimeout(entry.timeoutId);

    const safeIndex = Math.min(binCount - 1, Math.max(0, entry.targetBin));
    const mult = multipliers[safeIndex] ?? 1;

    if (sceneApi && mult >= 3) {
      sceneApi.celebrateBin(safeIndex, mult);
    }

    if (ballBody && sceneApi) {
      sceneApi.removeBall(ballBody);
    }

    const result: DropResult = {
      binIndex: safeIndex,
      multiplier: mult,
    };
    playLandForMultiplier(mult);
    onLandJuice?.(result);
    entry.resolve(result);
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width,
    height,
    parent,
    backgroundColor: "#00000000",
    transparent: true,
    audio: { noAudio: true },
    physics: {
      default: "matter",
      matter: {
        gravity: { x: 0, y: 1.35 },
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: PlinkoScene,
  });

  await new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (sceneApi) {
        resolve();
        return;
      }
      if (Date.now() - started > 8000) {
        reject(new Error("Plinko scene failed to start"));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const api: PlinkoGameApi = {
    dropBall(seed?: string) {
      return new Promise<DropResult>((resolve, reject) => {
        if (!sceneApi) {
          reject(new Error("Plinko scene not ready"));
          return;
        }
        if (activeBalls >= MAX_CONCURRENT_BALLS) {
          reject(new Error(`Too many balls in flight (max ${MAX_CONCURRENT_BALLS})`));
          return;
        }

        const ballId = nextBallId++;
        activeBalls += 1;

        const settle = (result: DropResult) => {
          activeBalls = Math.max(0, activeBalls - 1);
          resolve(result);
        };
        const fail = (err: Error) => {
          activeBalls = Math.max(0, activeBalls - 1);
          reject(err);
        };

        // Settlement odds from published weights; physics only steers visually.
        const targetBin = pickBinIndex(binWeights);
        pending.set(ballId, {
          resolve: settle,
          reject: fail,
          ballId,
          targetBin,
          timeoutId: setTimeout(() => undefined, 0),
        });
        // Slight extra spawn jitter so concurrent balls don't stack perfectly.
        const jitterSeed =
          seed ?? `c-${ballId}-${Math.random().toString(36).slice(2, 8)}`;
        sceneApi.spawnBall(ballId, jitterSeed, targetBin, (body) => {
          finishDrop(ballId, body);
        });
      });
    },

    setSpeed(speed: number) {
      const clamped = Math.max(0.5, Math.min(5, speed));
      speedScale = clamped;
      sceneApi?.applySpeed(clamped);
    },

    destroy() {
      for (const entry of pending.values()) {
        clearTimeout(entry.timeoutId);
        entry.reject(new Error("Board destroyed"));
      }
      pending.clear();
      activeBalls = 0;
      sceneApi = null;
      game.destroy(true);
    },
  };

  return api;
}
