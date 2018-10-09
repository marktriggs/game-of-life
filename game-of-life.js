var gol = {};

/// Utils
gol.Utils = {};

gol.Utils.generateGrid = function (width, height, valuefn) {
    var result = new Array(height);

    for (var y = 0; y < height; y++) {
        result[y] = new Array(width);
        for (var x = 0; x < width; x++) {
            result[y][x] = valuefn();
        }
    }

    return result;
};


/// The world
gol.World = function (x, y) {
    this.age = 0;
    this.width = x;
    this.height = y;

    this.state = gol.Utils.generateGrid(x, y, function () {
        return (Math.random() <= 0.15) ? 1 : 0;
    });

    // Extra padding around our array to avoid needing a bunch of conditionals around the edges of the map
    this.neighbourCounts = gol.Utils.generateGrid(this.width + 2, this.height + 2, function () { return 0; });

    this.initNeighbourCounts();
};


gol.World.prototype.incrementNeighbours = function (x, y, increment) {
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
};

gol.World.prototype.initNeighbourCounts = function () {
    var x, y;
    var width = this.width;
    var height = this.height;

    for (x = 0; x < width; x++) {
        for (y = 0; y < height; y++) {
            if (this.isAlive(x, y)) {
                this.incrementNeighbours(x, y, 1);
            }
        }
    }
};

gol.World.prototype.neighbourCount = function (x, y) {
    return this.neighbourCounts[y + 1][x + 1];
};

gol.World.prototype.giveLife = function (p) {
    this.incrementNeighbours(p.x, p.y, 1);
    this.state[p.y][p.x] = this.age + 1;
};

gol.World.prototype.takeLife = function (p) {
    this.incrementNeighbours(p.x, p.y, -1);
    this.state[p.y][p.x] = 0;
};

gol.World.prototype.isAlive = function (x, y) {
    return !!this.state[y][x];
};


gol.World.prototype.tick = function () {
    var self = this;

    var living = [];
    var dead = [];

    for (var y = 0; y < this.height; y++) {
        for (var x = 0; x < this.width; x++) {
            var neighbourCount = self.neighbourCount(x, y);

            if (self.isAlive(x, y) && (neighbourCount < 2 || neighbourCount > 3)) {
                dead.push({x: x, y: y});
            } else if (!self.isAlive(x, y) && (neighbourCount == 3)) {
                living.push({x: x, y: y});
            }
        }
    }

    living.forEach(self.giveLife, this);
    dead.forEach(self.takeLife, this);

    this.age++;

    return {
        births: living,
        deaths: dead,
    };
};



gol.Renderer = function (world, container, pixelSize) {
    this.world = world;
    this.container = container;
    this.pixelSize = pixelSize;

    this.container.innerHTML = '<canvas class="game-of-life-canvas"></canvas>';
    this.canvas = this.container.querySelector('.game-of-life-canvas');

    this.canvas.width = this.world.width * this.pixelSize;
    this.canvas.height = this.world.height * this.pixelSize;
};


gol.Renderer.prototype.render = function (changes) {
    var world = this.world;
    var self = this;

    var ctx = this.canvas.getContext('2d');

    changes.deaths.forEach(function (p) {
        ctx.clearRect(p.x * self.pixelSize,
                      p.y * self.pixelSize,
                      self.pixelSize,
                      self.pixelSize);
    });

    ctx.beginPath();
    ctx.fillStyle = '#421FFF';

    changes.births.forEach(function (p) {
        ctx.rect(p.x * self.pixelSize,
                 p.y * self.pixelSize,
                 self.pixelSize,
                 self.pixelSize);
    });

    ctx.fill();
};


window.onload = function () {
    var maxFPS = 30;

    var pixelSize = 3;
    var margin = pixelSize * 8;
    var world = new gol.World(Math.floor((document.body.clientWidth - margin) / pixelSize),
                              Math.floor((document.body.clientHeight - margin) / pixelSize));

    var renderer = new gol.Renderer(world,
                                    document.getElementById("game-of-life"),
                                    pixelSize);
    var lastTick = 0;
    var msPerFrame = (1000.0 / maxFPS);

    var ticker = function () {
        requestAnimationFrame(ticker);

        var now = Date.now();
        var delta = now - lastTick;

        if (delta >= msPerFrame) {
            lastTick = now - (delta % msPerFrame);

            var changes = world.tick();
            renderer.render(changes);
        }
    };

    requestAnimationFrame(ticker);
};
