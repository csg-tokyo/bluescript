
export class CompileError extends Error {
    static errorCode = 460;
    messages: {
        message: string,
        location?: SourceLocation | null
    }[]

    constructor(messages: { message: string, location?: SourceLocation | null }[]) {
        super();
        this.messages = messages;
    }

    toString() {
        let text = ''
        console.log(this.messages)
        for (const m of this.messages) {
            const line = m.location?.start.line
            text += `${m.message} in line ${line ? line : '??'}\n`
        }
        return text
    }
}

interface SourceLocation {
    start: {
        line: number;
        column: number;
    };
    end: {
        line: number;
        column: number;
    };
}

export class InternalError extends Error {
    static errorCode = 462;

    public constructor(message?: string) {
      super(`Internal Error: ${message}`);
    }
}

