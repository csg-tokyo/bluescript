export enum HostProtocol {
    None = 0,
    Load = 1,
    Call = 2,

    Log = 3,
    Error = 4,
    Exectime = 5,
    Loadtime = 6,
    Max
}

export function hostProtocolBuilder(protocol: HostProtocol, payload: string) {
    const protocolStr = String(protocol).padStart(2, '0');
    const payloadLen = String(payload.length).padStart(4, '0');
    return `${protocolStr} ${payloadLen} ${payload}\n`;
}


type HostProtocolPayloads = {
    [HostProtocol.None]: {};
    [HostProtocol.Load]: {};
    [HostProtocol.Call]: {};
    [HostProtocol.Log]: { log: string };
    [HostProtocol.Error]: { error: string };
    [HostProtocol.Exectime]: { time: number };
    [HostProtocol.Loadtime]: { time: number };
    [HostProtocol.Max]: {};
}

export type HostParseResult<T extends HostProtocol = HostProtocol> = {
    [K in T]: { protocol: K } & HostProtocolPayloads[K]
}[T];

type HostParserFunction<K extends HostProtocol> = (payload: string) => HostProtocolPayloads[K];

export class HostProtocolParser {
    private readonly parsers: {[K in HostProtocol]?: HostParserFunction<K>};

    constructor() {
        this.parsers = {
            [HostProtocol.Log]: HostProtocolParser.parseLog,
            [HostProtocol.Error]: HostProtocolParser.parseError,
            [HostProtocol.Exectime]: HostProtocolParser.parseExectime,
            [HostProtocol.Loadtime]: HostProtocolParser.parseLoadtime,
        }
    }

    public parse(line: string): {parsed: HostParseResult[], remain: string} {
        // The format is [xx yyyy zz...]
        // xx is protocol, yyyy is payload length, zz... is payload 
        const headerLength = 8;
        const parsed: HostParseResult[] = [];
        let remain: string = line;
        while (remain.length >= headerLength) {
            try {
                const protocol = Number(remain.substring(0, 2));
                const payloadLength = Number(remain.substring(3, 7));
                if (remain.length < headerLength + payloadLength) {
                    return { parsed, remain };
                }
                const payload = remain.substring(headerLength, headerLength + payloadLength);
                remain = remain.substring(headerLength + payloadLength);
                parsed.push(this.parsePayload(protocol, payload));
            } catch (error) {
                throw new Error("Failed to parse message.", { cause: error });
            }
            
        }
        return { parsed, remain };
    }

    private parsePayload(protocol: number, payload: string): HostParseResult {
        if (!this.isParseableProtocol(protocol)) {
            throw new Error(`Failed to parse buffer. The protocol ${protocol} is not parsable.`);
        }
        const parser = this.parsers[protocol]!;
        const parsedPayload = parser(payload);
        return {protocol, ...parsedPayload} as HostParseResult;
    }

    private isParseableProtocol(value: number): value is keyof typeof this.parsers {
        return value in this.parsers;
    }

    static parseLog(payload: string): { log: string } {
        return { log: payload };
    }

    static parseError(payload: string): { error: string } {
        return { error: payload };
    }

    static parseExectime(payload: string): { time: number } {
        return { time: Number(payload) };
    }

    static parseLoadtime(payload: string): { time: number } {
        return { time: Number(payload) };
    }
}
