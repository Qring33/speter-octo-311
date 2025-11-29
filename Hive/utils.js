class MouseHelper {
    constructor(page) {
        this.page = page;
        this.current = { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 };
        // set initial mouse position
        this.page.mouse.move(this.current.x, this.current.y);
    }

    async moveHuman(x, y) {
        const steps = 10 + Math.floor(Math.random() * 10);

        const dx = (x - this.current.x) / steps;
        const dy = (y - this.current.y) / steps;

        for (let i = 0; i < steps; i++) {
            const nx = this.current.x + dx + (Math.random() - 0.5) * 6;
            const ny = this.current.y + dy + (Math.random() - 0.5) * 6;

            await this.page.mouse.move(nx, ny);
            this.current = { x: nx, y: ny };

            await this.page.waitForTimeout(12 + Math.random() * 25);
        }

        // final target
        await this.page.mouse.move(x, y);
        this.current = { x, y };
    }

    async clickHuman() {
        await this.page.waitForTimeout(80 + Math.random() * 180);
        await this.page.mouse.down();
        await this.page.waitForTimeout(60 + Math.random() * 120);
        await this.page.mouse.up();
    }
}

module.exports = { MouseHelper };