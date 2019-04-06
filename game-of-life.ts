/* jshint esversion: 6 */

interface Point {
    x: number;
    y: number;
}

class World {
    private age: number;
    private state: number[][];
    private neighbourCounts: number[][];

    public width: number;
    public height: number;

    constructor(x: number, y: number) {
        this.age = 0;
        this.width = x;
        this.height = y;

        this.state = this.generateGrid(x, y, () => {
            return (Math.random() <= 0.08) ? 1 : 0;
        });

        // Extra padding around our array to avoid needing a bunch of conditionals around the edges of the map
        this.neighbourCounts = this.generateGrid(this.width + 2, this.height + 2, () => { return 0; });

        this.initNeighbourCounts();
    }

    generateGrid(width: number, height: number, valuefn: () => number) {
        const result = new Array(height);

        for (let y = 0; y < height; y++) {
            result[y] = new Array(width);
            for (let x = 0; x < width; x++) {
                result[y][x] = valuefn();
            }
        }

        return result;
    }

    incrementNeighbours(x: number, y: number, increment: number) {
        // adjust for our padding
        x += 1;
        y += 1;

        this.neighbourCounts[y - 1][x - 1] += increment;
        this.neighbourCounts[y - 1][x + 1] += increment;
        this.neighbourCounts[y + 1][x - 1] += increment;
        this.neighbourCounts[y + 1][x + 1] += increment;
        this.neighbourCounts[y - 1][x] += increment;
        this.neighbourCounts[y + 1][x] += increment;
        this.neighbourCounts[y][x - 1] += increment;
        this.neighbourCounts[y][x + 1] += increment;
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
        return this.neighbourCounts[y + 1][x + 1];
    }

    giveLife(p: Point) {
        this.incrementNeighbours(p.x, p.y, 1);
        this.state[p.y][p.x] = this.age + 1;
    }

    takeLife(p: Point) {
        this.incrementNeighbours(p.x, p.y, -1);
        this.state[p.y][p.x] = 0;
    }

    isAlive(x: number, y: number) {
        return !!this.state[y][x];
    }

    tick() {
        const living = [];
        const dead = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const neighbourCount = this.neighbourCount(x, y);

                if (this.isAlive(x, y) && (neighbourCount < 2 || neighbourCount > 3)) {
                    dead.push({x: x, y: y});
                } else if (!this.isAlive(x, y) && (neighbourCount == 3)) {
                    living.push({x: x, y: y});
                }
            }
        }

        living.forEach(this.giveLife, this);
        dead.forEach(this.takeLife, this);

        this.age++;

        return {
            births: living,
            deaths: dead,
        };
    }
}


interface WorldChanges {
    births: Point[];
    deaths: Point[];
}


class Renderer {
    private world: World;
    private container: HTMLElement;
    private pixelSize: number;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private bitmap: ImageData;

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
    }


    render(changes: WorldChanges) {
        /* Mark dead pixels as transparent */
        for (const p of changes.deaths) {
            for (let offsetY = 0; offsetY < this.pixelSize; offsetY++) {
                const bitmapY = ((p.y * this.pixelSize) + offsetY) * 4;

                for (let offsetX = 0; offsetX < this.pixelSize; offsetX++) {
                    const bitmapX = ((p.x * this.pixelSize) + offsetX) * 4;

                    this.bitmap.data[(bitmapY * this.canvas.width) + bitmapX + 3] = 0;
                }
            }
        }

        /* Fill living pixels */
        for (const p of changes.births) {
            for (let offsetY = 0; offsetY < this.pixelSize; offsetY++) {
                const bitmapY = ((p.y * this.pixelSize) + offsetY) * 4;

                for (let offsetX = 0; offsetX < this.pixelSize; offsetX++) {
                    const bitmapX = ((p.x * this.pixelSize) + offsetX) * 4;
                    const baseIdx = (bitmapY * this.canvas.width) + bitmapX;

                    this.bitmap.data[baseIdx + 0] = Renderer.fillRed;
                    this.bitmap.data[baseIdx + 1] = Renderer.fillGreen;
                    this.bitmap.data[baseIdx + 2] = Renderer.fillBlue;
                    this.bitmap.data[baseIdx + 3] = Renderer.fillAlpha;
                }
            }
        }

        this.ctx.putImageData(this.bitmap, 0, 0);
    }
}

window.onload = () => {
    const maxFPS = 30;

    const pixelSize = 2;
    const margin = pixelSize * 8;
    const world = new World(Math.floor((document.body.offsetWidth - margin) / pixelSize),
                            Math.floor((document.body.offsetHeight - margin) / pixelSize));

    const renderer = new Renderer(world,
                                  document.getElementById("game-of-life") as HTMLElement,
                                  pixelSize);
    let lastTick = 0;
    const msPerFrame = (1000.0 / maxFPS);

    let ticker = () => {
        requestAnimationFrame(ticker);

        const now = Date.now();
        const delta = now - lastTick;

        if (delta >= msPerFrame) {
            lastTick = now - (delta % msPerFrame);

            const changes = world.tick();
            renderer.render(changes);
        }
    };

    requestAnimationFrame(ticker);
};
