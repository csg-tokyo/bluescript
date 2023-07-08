export type integer = number;

export function newArray(length: number, init: any): any[] {
    return Array.from({length}, () => init);
}

export function assert(test: boolean) {}