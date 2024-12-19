import { useState } from "react"

const UNIT_SIZE = 100

export type MemoryT = {
    state: {
        name: string,
        address: number,
        size: number, 
        usedSize: number,
        buffer: boolean[],
        unitSize: number
    },
    actions: {
        reset: (size: number, address: number) => void,
        setUsedSegment: (start: number, size: number) => void,
    }
}

export const MemoryDummry = {
    state: {
        name: '',
        address: 0,
        size: 0, 
        usedSize: 0,
        buffer: [false],
        unitSize: UNIT_SIZE
    },
    actions: {
        reset: (size: number, address: number) => {},
        setUsedSegment: (start: number, size: number) => {},
    }
}

export function useMemory(memoryName: string): MemoryT {
    const [name, setName] = useState(memoryName)
    const [size, setSize] = useState(0)
    const [address, setAddress] = useState(0)
    const [usedSize, setUsedSize] = useState(0)
    const [buffer, setBuffer] = useState<boolean[]>([])

    const reset = (address: number, size: number) => {
        setBuffer(new Array<boolean>(Math.round(size / UNIT_SIZE)).fill(false))
        setSize(size)
        setAddress(address)
        setUsedSize(0)
    }

    const setUsedSegment = (startAddress: number, size: number) => {
        const start = startAddress - address
        setBuffer(buffer => buffer.map((v, i) => v || (i >= (start / UNIT_SIZE) && i < (start + size) / UNIT_SIZE)))
        setUsedSize(used => used + size)
    }

    return {
        state: {name, address, size, usedSize, buffer, unitSize: UNIT_SIZE},
        actions: {reset, setUsedSegment}
    }
}
