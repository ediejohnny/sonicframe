/** Bytes that arrive in pieces, read from the front: only what is not yet read is kept. */
export class ByteQueue {
    private data: Uint8Array = new Uint8Array(0);
    private start = 0;
    /** Bytes still to skip, set by `skip` past what has come so far. */
    private owed = 0;
    /** Bytes taken or skipped since the first. */
    private passed = 0;

    /** How many bytes are waiting. */
    get length(): number {
        return this.data.length - this.start;
    }

    /** Where the front is in the whole stream. */
    get offset(): number {
        return this.passed;
    }

    push(bytes: Uint8Array): void {
        let from = 0;

        if (this.owed > 0) {
            from = Math.min(this.owed, bytes.length);
            this.owed -= from;
            this.passed += from;
        }

        const rest = this.data.subarray(this.start);
        const merged = new Uint8Array(rest.length + bytes.length - from);
        merged.set(rest);
        merged.set(bytes.subarray(from), rest.length);
        this.data = merged;
        this.start = 0;
    }

    /** The byte `index` places from the front (undefined past what came). */
    at(index: number): number | undefined {
        return index < this.length ? this.data[this.start + index] : undefined;
    }

    /** The waiting bytes, without taking them. */
    view(): Uint8Array {
        return this.data.subarray(this.start);
    }

    /** Takes `count` bytes from the front, copied (fewer if fewer came). */
    take(count: number): Uint8Array {
        const end = Math.min(this.data.length, this.start + count);
        const taken = this.data.slice(this.start, end);
        this.passed += taken.length;
        this.start = end;

        return taken;
    }

    /** Drops `count` bytes from the front, also bytes not yet come. */
    skip(count: number): void {
        const now = Math.min(count, this.length);
        this.start += now;
        this.passed += now;
        this.owed += count - now;
    }
}
