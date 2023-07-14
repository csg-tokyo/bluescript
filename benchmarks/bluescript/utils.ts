export type integer = number;
export type float = number;

export function newArray(length: number, init: any): any[] {
    return Array.from({length}, () => init);
}

export function arrayLength(arr: any[]):integer { return 2 }

export function assert(test: boolean) {}

export function sqrt(target: float): float { return 0.0 }

export function abs(i: integer): integer { return 0 }

export function console_log_float(f: float) {}
