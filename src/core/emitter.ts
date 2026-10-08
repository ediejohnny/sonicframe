type Listener<Args extends unknown[]> = (...args: Args) => void;

/** A small typed event emitter: `on` returns the function that stops listening. */
export class Emitter<Events extends Record<string, unknown[]>> {
    private readonly listeners = new Map<
        keyof Events,
        Set<Listener<unknown[]>>
    >();

    on<Name extends keyof Events>(
        event: Name,
        listener: Listener<Events[Name]>,
    ): () => void {
        let set = this.listeners.get(event);

        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }

        // Stored loosely; `emit` only ever calls it with this event's arguments.
        const entry = listener as unknown as Listener<unknown[]>;
        set.add(entry);

        return () => {
            set.delete(entry);
        };
    }

    /**
     * Calls every listener present when the event happened. One that throws stops neither the others
     * nor the caller: its error is thrown again on its own (as an uncaught error), the way the browser
     * treats event handlers.
     */
    emit<Name extends keyof Events>(event: Name, ...args: Events[Name]): void {
        for (const listener of Array.from(this.listeners.get(event) ?? [])) {
            try {
                listener(...args);
            } catch (error) {
                queueMicrotask(() => {
                    throw error;
                });
            }
        }
    }

    clear(): void {
        this.listeners.clear();
    }
}
