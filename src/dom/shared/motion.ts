/** Whether the person asked the system for less motion: no growing bars, no pulsing buttons. */
export function prefersReducedMotion(): boolean {
    return (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}
