/**
 * Phaser Matter Plinko scene factory.
 * Phaser is imported dynamically so Node/SSR never evaluates the browser bundle.
 */
import { DEFAULT_MULTIPLIERS } from "@/lib/multipliers";
import {
  triangleGuideEndpoints,
  trianglePegCounts,
  trianglePegPositions,
} from "@/lib/peg-layout";
import type { DropResult, PlinkoGameApi } from "@/game/types";

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
  timeoutId: ReturnType<typeof setTimeout>;
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
  if (mult >= 50) return 0xb91c1c;
  if (mult >= 15) return 0xef4444;
  if (mult >= 6) return 0xf97316;
  if (mult >= 3) return 0xfbbf24;
  if (mult >= 1) return 0x2dd4bf;
  return 0x52525b;
}

export type CreatePlinkoGameOptions = {
  multipliers?: number[];
  width?: number;
  height?: number;
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
  const multipliers = options.multipliers ?? DEFAULT_MULTIPLIERS;
  const binCount = multipliers.length;

  let speedScale = 1;
  let nextBallId = 1;
  const pending = new Map<number, PendingDrop>();
  /** Serialize drops so AUTO can await one ball at a time. */
  let dropChain: Promise<unknown> = Promise.resolve();

  // Peg spacing for spawn jitter (set in createPegs).
  let pegSpacing = width / (binCount + 1);

  type SceneApi = {
    applySpeed: (speed: number) => void;
    spawnBall: (
      ballId: number,
      seed: string | undefined,
      onTimeout: (x: number, body: MatterBody) => void,
    ) => MatterBody;
    removeBall: (body: MatterBody) => void;
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
        spawnBall: (id, seed, onTimeout) => this.spawnBall(id, seed, onTimeout),
        removeBall: (body) => this.removeBall(body),
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
      // Soft plum → ink gradient
      g.fillGradientStyle(0x2a1528, 0x22142a, 0x14101c, 0x0c0a12, 1);
      g.fillRect(0, 0, width, height);

      // Sakura bloom washes
      g.fillStyle(0xffb7c5, 0.14);
      g.fillCircle(width * 0.18, height * 0.12, 90);
      g.fillStyle(0xff8fab, 0.1);
      g.fillCircle(width * 0.88, height * 0.22, 70);
      g.fillStyle(0xc8f542, 0.05);
      g.fillCircle(width * 0.5, height * 0.48, 110);

      // Soft petal dots
      g.fillStyle(0xffc9d6, 0.12);
      for (let i = 0; i < 18; i++) {
        const px = ((i * 97) % width) + (i % 3) * 7;
        const py = 30 + ((i * 53) % (height * 0.55));
        g.fillCircle(px, py, 2 + (i % 3));
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
      ) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        this.matter.add.rectangle(cx, cy, len, 6, {
          isStatic: true,
          label,
          angle,
          friction: 0.08,
          restitution: 0.4,
          collisionFilter: {
            category: this.pegCategory,
            mask: this.ballCategory,
          },
        });
        // Soft visual rail
        const g = this.add.graphics();
        g.lineStyle(2, 0xc8f542, 0.22);
        g.lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(6, 0xffb7c5, 0.08);
        g.lineBetween(a.x, a.y, b.x, b.y);
        g.setDepth(-1);
      };

      addSegment(left[0], left[1], "guide-left");
      addSegment(right[0], right[1], "guide-right");
    }

    private createPegs() {
      const topY = 52;
      const bottomY = height - 132;
      const pegRadius = 4.2;
      const marginX = 30;

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
        pad: 12,
      });
      pegSpacing = guides.spacing;

      this.createSlantGuides(guides.left, guides.right);

      // Faint pyramid fill behind pegs
      const fill = this.add.graphics();
      fill.fillStyle(0xc8f542, 0.03);
      fill.fillTriangle(
        guides.left[0].x,
        guides.left[0].y,
        guides.right[0].x,
        guides.right[0].y,
        width / 2,
        bottomY + 40,
      );
      fill.fillStyle(0xffb7c5, 0.04);
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
        // Glow halo + peg body
        const halo = this.add.circle(p.x, p.y, pegRadius + 3, 0xffb7c5, 0.18);
        halo.setDepth(0);
        const dot = this.add.circle(p.x, p.y, pegRadius, 0xf5e6c8, 1);
        dot.setStrokeStyle(1.5, 0xe8c48a, 0.95);
        dot.setDepth(1);
      }

      // Document row shape for debugging overlays (invisible)
      void counts;
    }

    private createBins() {
      const binTop = height - 100;
      const binHeight = 72;
      const binW = width / binCount;

      // Soft shelf under bins
      const shelf = this.add.graphics();
      shelf.fillStyle(0x0a0a0e, 0.55);
      shelf.fillRoundedRect(4, binTop - 4, width - 8, binHeight + 10, 10);
      shelf.lineStyle(1, 0xc8f542, 0.15);
      shelf.strokeRoundedRect(4, binTop - 4, width - 8, binHeight + 10, 10);
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
        const rect = this.add.rectangle(cx, binTop + binHeight / 2, chipW, chipH, color, 0.42);
        rect.setStrokeStyle(1.5, color, 0.95);
        rect.setDepth(2);
        this.add
          .text(cx, binTop + binHeight / 2, formatMult(mult), {
            fontSize: binCount > 12 ? "8px" : "11px",
            color: "#fafafa",
            fontStyle: "bold",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          })
          .setOrigin(0.5)
          .setDepth(3);
      }
    }

    private handlePair(a: MatterBody, b: MatterBody) {
      const labels = [a.label, b.label];
      const binLabel = labels.find((l) => typeof l === "string" && l.startsWith("bin-"));
      if (!binLabel) return;

      const ballBody = [a, b].find((body) => body.label?.startsWith("ball-"));
      if (!ballBody || !ballBody.label) return;

      const binIndex = Number(binLabel.slice(4));
      const ballId = Number(ballBody.label.slice(5));
      finishDrop(ballId, binIndex, ballBody);
    }

    spawnBall(
      ballId: number,
      seed: string | undefined,
      onTimeout: (x: number, body: MatterBody) => void,
    ): MatterBody {
      const unit = seed ? hashToUnit(seed) : Math.random();
      // Spawn near pyramid apex with small jitter (not full board width)
      const topSpread = Math.min(pegSpacing * 1.1, width * 0.12);
      const startX = width / 2 + (unit - 0.5) * topSpread;
      const radius = 6.5;

      // Outer glow
      const glow = this.add.circle(startX, 26, radius + 5, 0xc8f542, 0.28);
      glow.setDepth(4);
      const visual = this.add.circle(startX, 26, radius, 0xd4ff6a, 1);
      visual.setStrokeStyle(2, 0xffffff, 0.65);
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

      const body = (visual as unknown as { body: MatterBody }).body;

      // Keep glow glued via update — cheap follow using Matter body position
      const follow = () => {
        if (!body?.position || !glow.active) return;
        glow.setPosition(body.position.x, body.position.y);
      };
      this.events.on("update", follow);
      const cleanupGlow = () => {
        this.events.off("update", follow);
        if (glow.active) glow.destroy();
      };
      (body as MatterBody & { _cleanupGlow?: () => void })._cleanupGlow = cleanupGlow;

      const timeoutMs = Math.max(4000, 12000 / Math.max(speedScale, 0.5));
      const timeoutId = setTimeout(() => {
        const x = body?.position?.x ?? width / 2;
        onTimeout(x, body);
      }, timeoutMs);

      const entry = pending.get(ballId);
      if (entry) entry.timeoutId = timeoutId;

      return body;
    }

    removeBall(body: MatterBody) {
      try {
        const withGlow = body as MatterBody & { _cleanupGlow?: () => void };
        withGlow._cleanupGlow?.();
        if (body.gameObject) body.gameObject.destroy();
        else this.matter.world.remove(body as never);
      } catch {
        // already removed
      }
    }
  }

  function finishDrop(ballId: number, binIndex: number, ballBody?: MatterBody) {
    const entry = pending.get(ballId);
    if (!entry) return;
    pending.delete(ballId);
    clearTimeout(entry.timeoutId);

    if (ballBody && sceneApi) {
      sceneApi.removeBall(ballBody);
    }

    const safeIndex = Math.min(binCount - 1, Math.max(0, binIndex));
    entry.resolve({
      binIndex: safeIndex,
      multiplier: multipliers[safeIndex] ?? 1,
    });
  }

  function resolveByX(ballId: number, x: number, ballBody?: MatterBody) {
    const binW = width / binCount;
    const binIndex = Math.min(binCount - 1, Math.max(0, Math.floor(x / binW)));
    finishDrop(ballId, binIndex, ballBody);
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
      const run = () =>
        new Promise<DropResult>((resolve, reject) => {
          if (!sceneApi) {
            reject(new Error("Plinko scene not ready"));
            return;
          }
          const ballId = nextBallId++;
          pending.set(ballId, {
            resolve,
            reject,
            ballId,
            timeoutId: setTimeout(() => undefined, 0),
          });
          sceneApi.spawnBall(ballId, seed, (x, body) => {
            resolveByX(ballId, x, body);
          });
        });

      const next = dropChain.then(run, run);
      dropChain = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
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
      sceneApi = null;
      game.destroy(true);
    },
  };

  return api;
}
