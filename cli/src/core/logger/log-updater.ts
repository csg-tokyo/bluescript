import readline from 'readline';

export class LogUpdater {
    private stream: NodeJS.WriteStream;
    private lastOutput = '';
    private isUpdating = false;

    constructor(stream: NodeJS.WriteStream) {
        this.stream = stream;
    }

    public update(...text: string[]): void {
        this.clear();
        const newOutput = text.join(' ');
        this.stream.write(newOutput);
        this.lastOutput = newOutput;
        this.isUpdating = true;
    }

    public persistent(...text: string[]): void {
        this.update(...text);
        this.done();
    }

    public done(): void {
        if (!this.isUpdating) {
            return;
        }
        this.stream.write('\n');
        this.isUpdating = false;
        this.lastOutput = '';
    }

    public clear(): void {
        if (!this.isUpdating) {
            return;
        }
        const lines = this.getLineCount(this.lastOutput);
        for (let i = 0; i < lines; i++) {
            if (i > 0) {
                readline.moveCursor(this.stream, 0, -1);
            }
            readline.cursorTo(this.stream, 0);
            readline.clearLine(this.stream, 1);
        }
        this.isUpdating = false;
        this.lastOutput = '';
    }

    private getLineCount(str: string): number {
        const columns = this.stream.columns || 80;
        let lineCount = 0;
        for (const line of str.split('\n')) {
            const strippedLine = line.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
            lineCount += Math.max(1, Math.ceil(strippedLine.length / columns));
        }
        return lineCount;
    }
}

export const logUpdater = new LogUpdater(process.stdout);
