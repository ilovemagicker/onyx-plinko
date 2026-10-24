/**
 * Phaser Matter Plinko scene factory.
 * Phaser is imported dynamically so Node/SSR never evaluates the browser bundle.
 */
import { DEFAULT_MULTIPLIERS } from "@/lib/multipliers";
import type { DropResult, PlinkoGameApi } from "@/game/types";

export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 520;

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

  // Hoisted scene methods bound after class init — typed loosely for Phaser internals.
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

      matter.world.on("collisionstart", (event: { pairs: Array<{ bodyA: MatterBody; bodyB: MatterBody }> }) => {
        for (const pair of event.pairs) {
          this.handlePair(pair.bodyA, pair.bodyB);
        }
      });

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
      g.fillGradientStyle(0x2a1520, 0x2a1520, 0x1a1028, 0x14101c, 1);
      g.fillRect(0, 0, width, height);
      g.fillStyle(0xffb7c5, 0.08);
      g.fillCircle(width * 0.2, height * 0.15, 80);
      g.fillStyle(0xff8fab, 0.06);
      g.fillCircle(width * 0.85, height * 0.25, 60);
      g.fillStyle(0xc8f542, 0.04);
      g.fillCircle(width * 0.5, height * 0.55, 100);
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
      this.matter.add.rectangle(-thickness / 2, height / 2, thickness, height, wallOpts);
      this.matter.add.rectangle(width + thickness / 2, height / 2, thickness, height, wallOpts);
      this.matter.add.rectangle(width / 2, height + 10, width + 40, 24, {
        ...wallOpts,
        label: "floor",
      });
    }

    private createPegs() {
      const rows = 12;
      const topY = 56;
      const bottomY = height - 140;
      const rowGap = (bottomY - topY) / (rows - 1);
      const pegRadius = 4.5;

      for (let row = 0; row < rows; row++) {
        const pegsInRow = row % 2 === 0 ? binCount - 1 : binCount;
        const y = topY + row * rowGap;
        const spacing = width / (pegsInRow + 1);
        for (let i = 0; i < pegsInRow; i++) {
          const x = spacing * (i + 1);
          this.matter.add.circle(x, y, pegRadius, {
            isStatic: true,
            label: "peg",
            friction: 0.05,
            restitution: 0.55,
            collisionFilter: {
              category: this.pegCategory,
              mask: this.ballCategory,
            },
          });
          const dot = this.add.circle(x, y, pegRadius, 0xe8d5b7, 1);
          dot.setStrokeStyle(1, 0xc4a574, 0.9);
        }
      }
    }

    private createBins() {
      const binTop = height - 100;
      const binHeight = 70;
      const binW = width / binCount;

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
          this.add.rectangle(binW * i, binTop + binHeight / 2, 2, binHeight, 0x3f3f46);
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

        const color =
          mult >= 15 ? 0xff6b6b : mult >= 3 ? 0xfbbf24 : mult >= 1 ? 0x34d399 : 0x71717a;
        const rect = this.add.rectangle(
          cx,
          binTop + binHeight / 2,
          binW - 2,
          binHeight - 4,
          color,
          0.35,
        );
        rect.setStrokeStyle(1, color, 0.8);
        this.add
          .text(cx, binTop + binHeight / 2, formatMult(mult), {
            fontSize: binCount > 12 ? "9px" : "11px",
            color: "#f4f4f5",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          })
          .setOrigin(0.5);
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
      const startX = width / 2 + (unit - 0.5) * (width * 0.35);
      const radius = 6;

      const visual = this.add.circle(startX, 28, radius, 0xc8f542, 1);
      visual.setStrokeStyle(2, 0xffffff, 0.5);

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

      const timeoutMs = Math.max(4000, 12000 / Math.max(speedScale, 0.5));
      const timeoutId = setTimeout(() => {
        const x = body?.position?.x ?? width / 2;
        onTimeout(x, body);
      }, timeoutMs);

      // Store timeout on pending — caller creates pending entry first.
      const entry = pending.get(ballId);
      if (entry) entry.timeoutId = timeoutId;

      return body;
    }

    removeBall(body: MatterBody) {
      try {
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
    // Scene create runs on first frame
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
          // Register pending BEFORE spawn so a fast collision cannot miss resolve.
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
