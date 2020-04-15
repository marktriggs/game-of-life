/* jshint esversion: 6 */

class Grid {
    private grid: Uint8Array;
    private width: number;
    private height: number;

    constructor(width: number, height: number, valuefn: () => number) {
        this.width = width;
        this.height = height;
        this.grid = new Uint8Array(width * height);

        for (var i = 0; i < this.grid.length; i++) {
            this.grid[i] = valuefn();
        }
    }

    get(x: number, y: number): number {
        return this.grid[(y * this.width) + x];
    }

    set(x: number, y: number, value: number) {
        this.grid[(y * this.width) + x] = value;
    }

    increment(x: number, y: number, offset: number) {
        this.grid[(y * this.width) + x] += offset;
    }
}


class World {
    private state: Grid;
    private neighbourCounts: Grid;

    public width: number;
    public height: number;

    constructor(x: number, y: number) {
        this.width = x;
        this.height = y;

        this.state = new Grid(x, y, () => {
            return (Math.random() <= 0.08) ? 1 : 0;
        });

        // Extra padding around our array to avoid needing a bunch of conditionals around the edges of the map
        this.neighbourCounts = new Grid(this.width + 2, this.height + 2, () => { return 0; });

        this.initNeighbourCounts();
    }

    incrementNeighbours(x: number, y: number, increment: number) {
        // adjust for our padding
        x += 1;
        y += 1;

        this.neighbourCounts.increment(x - 1, y - 1, increment);
        this.neighbourCounts.increment(x + 1, y - 1, increment);
        this.neighbourCounts.increment(x - 1, y + 1, increment);
        this.neighbourCounts.increment(x + 1, y + 1, increment);
        this.neighbourCounts.increment(x, y - 1, increment);
        this.neighbourCounts.increment(x, y + 1, increment);
        this.neighbourCounts.increment(x - 1, y, increment);
        this.neighbourCounts.increment(x + 1, y, increment);
    }

    initNeighbourCounts() {
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                if (this.isAlive(x, y)) {
                    this.incrementNeighbours(x, y, 1);
                }
            }
        }
    }

    neighbourCount(x: number, y: number): number {
        return this.neighbourCounts.get(x + 1, y + 1);
    }

    giveLife(x: number, y: number) {
        this.incrementNeighbours(x, y, 1);
        this.state.set(x, y, 1);
    }

    takeLife(x: number, y: number) {
        this.incrementNeighbours(x, y, -1);
        this.state.set(x, y, 0);
    }

    isAlive(x: number, y: number) {
        return !!this.state.get(x, y);
    }

    tick(changes: WorldChanges) {
        changes.clear();

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const neighbourCount = this.neighbourCount(x, y);

                if (this.isAlive(x, y) && (neighbourCount < 2 || neighbourCount > 3)) {
                    changes.deaths.push(x, y);
                } else if (!this.isAlive(x, y) && (neighbourCount == 3)) {
                    changes.births.push(x, y);
                }
            }
        }

        changes.deaths.forEach((x, y) => { this.takeLife(x, y) });
        changes.births.forEach((x, y) => { this.giveLife(x, y) });
    }
}


class PointSet {
    private xs: Uint16Array;
    private ys: Uint16Array;
    private idx: number;

    constructor(size: number) {
        this.xs = new Uint16Array(size);
        this.ys = new Uint16Array(size);
        this.idx = 0;
    }

    push(x: number, y: number) {
        this.xs[this.idx] = x;
        this.ys[this.idx] = y;

        this.idx += 1;
    }

    clear() {
        this.idx = 0;
    }

    forEach(fn: (x: number, y: number) => void) {
        for (var i = 0; i < this.idx; i++) {
            fn(this.xs[i], this.ys[i]);
        }
    }
}

class WorldChanges {
    public births: PointSet;
    public deaths: PointSet;

    constructor(width: number, height: number) {
        this.births = new PointSet(width * height);
        this.deaths = new PointSet(width * height);
    }

    public clear() {
        this.births.clear();
        this.deaths.clear();
    }
}


class Renderer {
    private world: World;
    private container: HTMLElement;
    private pixelSize: number;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private bitmap: ImageData;

    private debug: boolean;
    private fps: number;

    static readonly fillRed = 66;
    static readonly fillGreen = 31;
    static readonly fillBlue = 255;
    static readonly fillAlpha = 255;

    constructor(world: World, container: HTMLElement, pixelSize: number) {
        this.world = world;
        this.container = container;
        this.pixelSize = pixelSize;

        this.container.innerHTML = '<canvas class="game-of-life-canvas"></canvas>';
        this.canvas = this.container.querySelector('.game-of-life-canvas') as HTMLCanvasElement;

        this.canvas.width = this.world.width * this.pixelSize;
        this.canvas.height = this.world.height * this.pixelSize;

        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        this.bitmap = this.ctx.createImageData(this.canvas.width, this.canvas.height);

        // Init all pixels to the right colour but full transparency
        for (let y = 0; y < this.world.height; y++) {
            for (let x = 0; x < this.world.width; x++) {
                for (let offsetY = 0; offsetY < this.pixelSize; offsetY++) {
                    const bitmapY = ((y * this.pixelSize) + offsetY) * 4;

                    for (let offsetX = 0; offsetX < this.pixelSize; offsetX++) {
                        const bitmapX = ((x * this.pixelSize) + offsetX) * 4;
                        const baseIdx = (bitmapY * this.canvas.width) + bitmapX;

                        this.bitmap.data[baseIdx + 0] = Renderer.fillRed;
                        this.bitmap.data[baseIdx + 1] = Renderer.fillGreen;
                        this.bitmap.data[baseIdx + 2] = Renderer.fillBlue;
                        this.bitmap.data[baseIdx + 3] = 0;
                    }
                }
            }
        }

        this.ctx.font = '14px serif';
        this.ctx.fillStyle = '#ff0000';

        this.fps = 0;
    }

    setDebug(val: boolean) {
        this.debug = val;
    }

    setFPS(fps: number) {
        this.fps = Math.round(fps);
    }

    render(changes: WorldChanges) {
        changes.deaths.forEach((x: number, y: number) => {
            for (let offsetY = 0; offsetY < this.pixelSize; offsetY++) {
                const bitmapY = ((y * this.pixelSize) + offsetY) * 4;

                for (let offsetX = 0; offsetX < this.pixelSize; offsetX++) {
                    const bitmapX = ((x * this.pixelSize) + offsetX) * 4;

                    this.bitmap.data[(bitmapY * this.canvas.width) + bitmapX + 3] = 0;
                }
            }
        });

        /* Fill living pixels */
        changes.births.forEach((x: number, y: number) => {
            for (let offsetY = 0; offsetY < this.pixelSize; offsetY++) {
                const bitmapY = ((y * this.pixelSize) + offsetY) * 4;

                for (let offsetX = 0; offsetX < this.pixelSize; offsetX++) {
                    const bitmapX = ((x * this.pixelSize) + offsetX) * 4;

                    this.bitmap.data[(bitmapY * this.canvas.width) + bitmapX + 3] = Renderer.fillAlpha;
                }
            }
        });

        this.ctx.putImageData(this.bitmap, 0, 0);

        if (this.debug) {
            this.ctx.fillText(`FPS: ${this.fps}`, 10, 20);
        }
    }
}

window.onload = () => {
    const debug = false;
    const maxFPS = debug ? 99999 : 30;

    const pixelSize = 1;
    const margin = pixelSize * 8;
    const world = new World(Math.floor((document.body.offsetWidth - margin) / pixelSize),
                            Math.floor((document.body.offsetHeight - margin) / pixelSize));

    const renderer = new Renderer(world,
                                  document.getElementById("game-of-life") as HTMLElement,
                                  pixelSize);

    renderer.setDebug(debug);

    let lastTick = 0;
    const msPerFrame = (1000.0 / maxFPS);

    let fpsStart = Date.now();
    let fpsCount = 0;

    let changes = new WorldChanges(world.width, world.height);

    let ticker = () => {
        requestAnimationFrame(ticker);

        const now = Date.now();
        const delta = now - lastTick;

        if (delta >= msPerFrame) {
            fpsCount += 1;

            lastTick = now - (delta % msPerFrame);

            world.tick(changes);
            renderer.render(changes);

            if (fpsCount === 200) {
                renderer.setFPS(fpsCount / ((now - fpsStart) / 1000.0));
                fpsCount = 0;
                fpsStart = now;
            }
        }
    };

    requestAnimationFrame(ticker);
};
