export class SerialTaskQueue {
    private processing = false;
    private queue: Array<() => Promise<void>> = [];

    enqueue(task: () => Promise<void>): void {
        this.queue.push(task);
        void this.drain();
    }

    private async drain(): Promise<void> {
        if (this.processing) {
            return;
        }
        this.processing = true;
        while (this.queue.length > 0) {
            const task = this.queue.shift()!;
            await task();
        }
        this.processing = false;
    }
}
