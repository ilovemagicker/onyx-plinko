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
import {
  STUCK_SPEED_EPSILON,
  STUCK_SHELF_MARGIN,
  antiStuckVelocity,
  ballSpeed,
  guideClampInset,
  isStuckAboveBins,
  isYStagnant,
  spawnDropVelocity,
  steeredVx,
  velocityWithSteeredX,
} from "@/lib/anti-stuck";

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
  if (mult >= 100) return 0xffd54a; // gold
  if (mult >= 20) return 0xff4f8a; // hot pink
  if (mult >= 8) return 0xff7a3d; // orange
  if (mult >= 4) return 0xffc933; // amber
  if (mult >= 2) return 0x7dff6a; // lime
  if (mult >= 1) return 0x3ad0ff; // cyan
  return 0x8aa0c8; // soft steel
}

const PEG_PALETTE = [0xffd54a, 0xff8fd6, 0x5ad0ff, 0x7dff6a, 0xffb020];

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

      this.drawArcadeBackdrop();
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

    private drawArcadeBackdrop() {
      const g = this.add.graphics();
      // Sky wash behind board plate
      g.fillGradientStyle(0x6ecfff, 0x6ecfff, 0x3eb6ff, 0x3eb6ff, 1);
      g.fillRect(0, 0, width, height);

      // Soft clouds
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(width * 0.18, 36, 28);
      g.fillCircle(width * 0.28, 40, 22);
      g.fillCircle(width * 0.78, 48, 30);
      g.fillCircle(width * 0.88, 44, 20);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(width * 0.5, height - 30, 40);

      // Dark playfield plate (charcoal) — reads as arcade bed
      g.fillStyle(0x2e3548, 1);
      g.fillRoundedRect(16, 28, width - 32, height - 120, 18);
      g.fillStyle(0x3a4258, 0.55);
      g.fillRoundedRect(22, 34, width - 44, height - 136, 14);

      // Sparkles
      g.fillStyle(0xffffff, 0.7);
      for (const [sx, sy] of [
        [40, 70],
        [320, 90],
        [60, 200],
        [300, 240],
        [180, 120],
      ] as Array<[number, number]>) {
        g.fillCircle(sx, sy, 1.6);
      }

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

      // Candy chevron side rails (arcade runway)
      const g = this.add.graphics();
      const paintRail = (
        a: { x: number; y: number },
        b: { x: number; y: number },
        outward: number,
      ) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * outward;
        const ny = (dx / len) * outward;
        // Outer orange glow band
        g.fillStyle(0xff9a3c, 0.95);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.lineTo(b.x + nx, b.y + ny);
        g.lineTo(a.x + nx, a.y + ny);
        g.closePath();
        g.fillPath();
        // Yellow chevron stripes
        g.lineStyle(3, 0xffe566, 0.9);
        const steps = 10;
        for (let i = 0; i < steps; i++) {
          const t0 = i / steps;
          const t1 = Math.min(1, (i + 0.45) / steps);
          const x0 = a.x + dx * t0 + nx * 0.25;
          const y0 = a.y + dy * t0 + ny * 0.25;
          const x1 = a.x + dx * t1 + nx * 0.75;
          const y1 = a.y + dy * t1 + ny * 0.75;
          g.lineBetween(x0, y0, x1, y1);
        }
      };
      paintRail(left[0], left[1], -16);
      paintRail(right[0], right[1], 16);

      // Drop mouth
      const mouthPad = 12;
      const mx0 = left[0].x - mouthPad;
      const mx1 = right[0].x + mouthPad;
      const my = left[0].y - 8;
      g.fillStyle(0xffe566, 1);
      g.fillRoundedRect(mx0, my - 10, mx1 - mx0, 18, 8);
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeRoundedRect(mx0, my - 10, mx1 - mx0, 18, 8);
      g.fillStyle(0x2e3548, 0.85);
      g.fillRoundedRect(mx0 + 6, my - 4, mx1 - mx0 - 12, 10, 5);

      g.fillStyle(0xffe566, 0.9);
      g.fillRoundedRect(left[1].x - 7, left[1].y - 2, 14, 8, 3);
      g.fillRoundedRect(right[1].x - 7, right[1].y - 2, 14, 8, 3);
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
      best.halo.setAlpha(0.35);
      this.tweens.add({
        targets: best.container,
        scale: 1.35,
        duration: 50,
        yoyo: true,
        ease: "Back.easeOut",
      });
      this.tweens.add({
        targets: best.halo,
        alpha: 0.7,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          if (best?.halo.active) best.halo.setAlpha(0.35);
        },
      });

      // Floating +score pops (arcade juice)
      const pop = this.add
        .text(x, y - 8, "+1", {
          fontSize: "12px",
          color: "#ffe566",
          fontStyle: "bold",
          fontFamily: "ui-rounded, system-ui, sans-serif",
        })
        .setOrigin(0.5)
        .setDepth(30)
        .setStroke("#5a3a00", 3);
      this.tweens.add({
        targets: pop,
        y: y - 36,
        alpha: 0,
        scale: 1.25,
        duration: 420,
        ease: "Quad.easeOut",
        onComplete: () => pop.destroy(),
      });
      // Tiny spark burst
      for (let i = 0; i < 5; i++) {
        const ang = (Math.PI * 2 * i) / 5;
        const spark = this.add.circle(x, y, 2, 0xffffff, 0.95).setDepth(29);
        this.tweens.add({
          targets: spark,
          x: x + Math.cos(ang) * 14,
          y: y + Math.sin(ang) * 14,
          alpha: 0,
          duration: 220,
          onComplete: () => spark.destroy(),
        });
      }
    }

    private createPegs() {
      const topY = 48;
      const bottomY = height - 126;
      const pegRadius = 4.0;
      const marginX = 28;
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

      // Soft plate behind pegs
      const fill = this.add.graphics();
      fill.fillStyle(0xffffff, 0.04);
      fill.fillTriangle(
        guides.left[0].x,
        guides.left[0].y,
        guides.right[0].x,
        guides.right[0].y,
        width / 2,
        bottomY + 40,
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
        // Glossy 3D-ish cylinder pegs (color cycles gold / pink / cyan / lime)
        const color = PEG_PALETTE[(p.row + p.col) % PEG_PALETTE.length]!;
        const depthScale = 0.92 + (p.y / height) * 0.14; // slightly larger toward viewer
        const halo = this.add.circle(0, 0, pegRadius + 5, color, 0.35);
        const body = this.add.ellipse(0, 1.2, (pegRadius + 1.2) * 2, (pegRadius + 2.2) * 2, color, 1);
        body.setStrokeStyle(1.2, 0xffffff, 0.35);
        const top = this.add.ellipse(0, -1.6, (pegRadius + 0.4) * 2, pegRadius * 1.4, 0xffffff, 0.35);
        const core = this.add.ellipse(0, -0.4, pegRadius * 1.5, pegRadius * 1.1, color, 1);
        const highlight = this.add.circle(-1.2, -2.0, Math.max(0.8, pegRadius - 2.2), 0xffffff, 0.85);
        const container = this.add.container(p.x, p.y, [halo, body, core, top, highlight]);
        container.setScale(depthScale);
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
      const binTop = height - 96;
      const binHeight = 68;
      const binW = width / binCount;
      this.binRects = [];

      // Prize shelf tray
      const shelf = this.add.graphics();
      shelf.fillStyle(0x1c2233, 0.9);
      shelf.fillRoundedRect(8, binTop - 8, width - 16, binHeight + 18, 16);
      shelf.lineStyle(3, 0xffe566, 0.85);
      shelf.strokeRoundedRect(8, binTop - 8, width - 16, binHeight + 18, 16);
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
        const cy = binTop + binHeight / 2 + 2;
        const holeR = Math.max(7, Math.min(binW * 0.42, 14));

        // Glowing ring pocket
        if (mult >= 8) {
          const glow = this.add.circle(cx, cy, holeR + 6, color, 0.28);
          glow.setDepth(1);
        }
        const outer = this.add.circle(cx, cy, holeR + 3, color, 0.95);
        outer.setStrokeStyle(2, 0xffffff, 0.65);
        outer.setDepth(2);
        const hole = this.add.circle(cx, cy, holeR, 0x12151f, 0.95);
        hole.setDepth(2.2);
        // Use outer as celebrate target (rect API shim via circle)
        const rect = outer as unknown as {
          x: number;
          y: number;
          active: boolean;
          setFillStyle: (c: number, a: number) => void;
          setStrokeStyle: (w: number, c: number, a: number) => void;
          setScale: (x: number, y?: number) => void;
        };

        this.binRects.push({ rect, baseColor: color, mult });
        const label = this.add
          .text(cx, cy + holeR + 11, formatMult(mult), {
            fontSize: binCount > 14 ? "8px" : binCount > 12 ? "9px" : "10px",
            color: "#fffdf7",
            fontStyle: "bold",
            fontFamily: "ui-rounded, system-ui, sans-serif",
          })
          .setOrigin(0.5)
          .setDepth(3);
        label.setStroke("#1a2550", 3);
        label.setAlpha(1);
        void hole;
      }
    }

    /** Flash pocket + coin / star burst on land. */
    celebrateBin(binIndex: number, mult: number) {
      const entry = this.binRects[binIndex];
      if (!entry) return;
      const { rect, baseColor } = entry;
      const flashColor = mult >= 100 ? 0xffe566 : mult >= 15 ? 0xff8fd6 : 0x7dff6a;
      rect.setFillStyle(flashColor, 1);
      rect.setStrokeStyle(3, 0xffffff, 1);
      this.tweens.add({
        targets: rect,
        scaleX: 1.28,
        scaleY: 1.28,
        duration: 140,
        yoyo: true,
        ease: "Back.easeOut",
        onComplete: () => {
          if (!rect.active) return;
          rect.setScale(1);
          rect.setFillStyle(baseColor, 0.95);
          rect.setStrokeStyle(2, 0xffffff, 0.65);
        },
      });

      const cx = rect.x;
      const cy = rect.y;
      const n = mult >= 100 ? 16 : mult >= 15 ? 14 : mult >= 3 ? 10 : 6;
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (Math.PI * 1.2 * (i / Math.max(1, n - 1)) - 0.6);
        const dist = 28 + Math.random() * 36;
        const isStar = i % 3 === 0;
        const coin = this.add.circle(
          cx,
          cy,
          isStar ? 3.5 : 5,
          isStar ? 0xffffff : 0xffd54a,
          1,
        );
        coin.setStrokeStyle(1.5, isStar ? 0xffe566 : 0xffffff, 0.9);
        coin.setDepth(25);
        this.tweens.add({
          targets: coin,
          x: cx + Math.cos(ang) * dist,
          y: cy + Math.sin(ang) * dist - 20,
          alpha: 0,
          scale: 0.3,
          duration: 480 + Math.random() * 220,
          ease: "Quad.easeOut",
          onComplete: () => coin.destroy(),
        });
      }
      // Center sparkle flare
      const flare = this.add.circle(cx, cy, 10, 0xffffff, 0.9).setDepth(26);
      this.tweens.add({
        targets: flare,
        scale: 3.2,
        alpha: 0,
        duration: 320,
        onComplete: () => flare.destroy(),
      });
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
      // Higher than first peg (topY=52) with clearance; initial vy punches through mouth.
      const spawnY = 22;
      let startX =
        apex +
        (targetX - apex) * 0.28 +
        (unit - 0.5) * topSpread +
        (Math.random() - 0.5) * Math.min(pegSpacing * 0.35, 10);
      // Keep spawn inside the triangle; inset must not invert the throat
      // (fixed radius+N used to funnel every ball onto the center apex peg).
      if (guideEndpoints) {
        const env = guideEnvelopeXAtY(guideEndpoints, spawnY);
        const gap = env.rightX - env.leftX;
        const inset = guideClampInset({ gap, preferred: 3, minUsable: 8 });
        startX = Math.min(env.rightX - inset, Math.max(env.leftX + inset, startX));
      }

      // Glossy gold coin ball + soft aura
      const glow = this.add.circle(startX, spawnY, radius + 8, 0xffe566, 0.35);
      glow.setDepth(4);
      const visual = this.add.circle(startX, spawnY, radius, 0xffd54a, 1);
      visual.setStrokeStyle(2, 0xffffff, 0.95);
      visual.setDepth(5);
      const ballSpec = this.add.circle(startX - 1.4, spawnY - 2.0, radius * 0.34, 0xffffff, 0.85);
      ballSpec.setDepth(6);
      const coinInner = this.add.circle(startX, spawnY, radius * 0.45, 0xfff3a0, 0.55);
      coinInner.setDepth(5.5);

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

      // Clear initial downward (+ slight horizontal) velocity so the ball
      // cannot rest at the mouth or balance on the first peg row.
      {
        const drop = spawnDropVelocity();
        matterBodyApi.setVelocity(body, { x: drop.vx, y: drop.vy });
      }

      // Lime trail ghosts (max 8); keep glow glued + steer toward target bin.
      const trails: Phaser.GameObjects.Arc[] = [];
      let trailFrame = 0;
      /** Wall-clock stamp when speed first dropped near zero above the shelf. */
      let stuckSince: number | null = null;
      /** Y-stagnation window — catches peg rests even when speed flickers. */
      let stagnantY0 = spawnY;
      let stagnantFrames = 0;
      const follow = () => {
        if (!body?.position || !glow.active) return;
        let x = body.position.x;
        let y = body.position.y;
        let vx = body.velocity?.x ?? 0;
        // Do not cache vy for writes — always re-read engine y when setting velocity.

        if (guideEndpoints && y < BIN_TOP - 6) {
          const env = guideEnvelopeXAtY(guideEndpoints, y);
          const gap = env.rightX - env.leftX;
          const inset = guideClampInset({ gap, preferred: 2, minUsable: 10 });
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
        if (ballSpec.active) {
          ballSpec.setPosition(x - 1.4, y - 2.0);
        }
        if (coinInner.active) {
          coinInner.setPosition(x, y);
        }

        // Short marble trail every 2–3 frames (cap 8 ghosts for perf)
        trailFrame += 1;
        if (trailFrame % 3 === 0) {
          while (trails.length >= 8) {
            const old = trails.shift();
            if (old?.active) old.destroy();
          }
          const ghost = this.add.circle(x, y, radius * 0.68, 0xffe566, 0.35);
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

        // Track near-zero motion above the bin shelf (peg-apex rest).
        const engVy = body.velocity?.y ?? 0;
        const speed = ballSpeed(vx, engVy);
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (speed < STUCK_SPEED_EPSILON && y < BIN_TOP - STUCK_SHELF_MARGIN) {
          if (stuckSince == null) stuckSince = now;
        } else {
          stuckSince = null;
        }
        const stuckMs = stuckSince == null ? 0 : now - stuckSince;

        // Y-stagnation: if y barely advances while above the shelf, treat as stuck
        // even when speed flickers above epsilon from micro-collisions.
        if (y < BIN_TOP - STUCK_SHELF_MARGIN) {
          if (y - stagnantY0 < 0.6) {
            stagnantFrames += 1;
          } else {
            stagnantY0 = y;
            stagnantFrames = 1;
          }
        } else {
          stagnantFrames = 0;
          stagnantY0 = y;
        }

        const stagnant = isYStagnant({
          y,
          yAtWindowStart: stagnantY0,
          framesInWindow: stagnantFrames,
          binTop: BIN_TOP,
        });

        // Defense in depth: near-zero speed OR y not advancing → unstick.
        if (
          stagnant ||
          isStuckAboveBins({
            speed,
            y,
            binTop: BIN_TOP,
            stuckMs,
          })
        ) {
          const nudge = antiStuckVelocity();
          // Teleport 1–2px down so peg contact can't instantly nullify the impulse.
          y = y + 1.5;
          matterBodyApi.setPosition(body, { x, y });
          matterBodyApi.setVelocity(body, {
            x: nudge.vx,
            y: Math.max(engVy, nudge.vy),
          });
          stuckSince = null;
          stagnantFrames = 0;
          stagnantY0 = y;
          return;
        }

        const dx = targetX - x;
        // Mild horizontal pull; clamp so peg bounces still read as physics.
        // Skip vx damp when nearly stopped so micro-drift can tip off pegs.
        // Only rewrite x — keep Matter's current vy so gravity is not cancelled.
        const steer = Math.max(-2.8, Math.min(2.8, dx * 0.045));
        const newVx = steeredVx({ vx, steer, speed });
        const liveVy = body.velocity?.y ?? engVy;
        matterBodyApi.setVelocity(
          body,
          velocityWithSteeredX({ newVx, engineVy: liveVy }),
        );
      };
      this.events.on("update", follow);
      const cleanupGlow = () => {
        this.events.off("update", follow);
        if (glow.active) glow.destroy();
        if (ballSpec.active) ballSpec.destroy();
        if (coinInner.active) coinInner.destroy();
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

  // Pin parent box so canvas cannot alter flex layout (FIT used to thrash size).
  parent.style.position = parent.style.position || "relative";
  parent.style.overflow = "hidden";
  parent.style.width = "100%";
  parent.style.height = "100%";

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
        // Explicit: resting on a peg must not sleep; steer/anti-stuck need wake.
        enableSleeping: false,
      },
    },
    // NONE: render at logical 360×520; CSS stretches into the aspect-locked stage.
    // Avoids Scale.FIT reading parent → writing canvas size → parent reflow loops.
    scale: {
      mode: Phaser.Scale.NONE,
    },
    scene: PlinkoScene,
  });

  // Force canvas to fill the locked stage; ignore devicePixelRatio churn.
  const applyCanvasFill = () => {
    const canvas = game.canvas;
    if (!canvas) return;
    canvas.style.display = "block";
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.maxWidth = "100%";
    canvas.style.maxHeight = "100%";
  };
  applyCanvasFill();
  game.events.on("ready", applyCanvasFill);

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
