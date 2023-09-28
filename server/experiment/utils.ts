export type integer = number;
export type float = number;

export function newArray(length: number, init: any): any[] {
  return Array.from({length}, () => init);
}

export function assert(test: boolean) {}

export function sqrt(f: float): float { return f**0.5 }

export function console_log_float(f: float) {
  console.log(f);
}
