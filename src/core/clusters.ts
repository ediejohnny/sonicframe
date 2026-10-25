/**
 * Grouping nearby marks so a crowd of them reads as one pill with a count instead of a smear of
 * lines. Pure: given each mark's position along the frame, a left-to-right sweep joins any that sit
 * within `distance` of the running group. Positions that are not finite numbers are dropped.
 */

export type Cluster = {
    /** Indices into the input, in order of position. */
    indices: number[];
    /** The leftmost and rightmost positions in the cluster. */
    from: number;
    to: number;
    /** The midpoint, where a pill is centered. */
    center: number;
};

export function groupMarks(
    positions: readonly number[],
    distance: number,
): Cluster[] {
    const ordered = positions
        .map((x, index) => ({ x, index }))
        .filter((point) => Number.isFinite(point.x))
        .sort((a, b) => a.x - b.x);

    const clusters: Cluster[] = [];

    for (const point of ordered) {
        const last = clusters.at(-1);

        if (last !== undefined && point.x - last.to <= distance) {
            last.indices.push(point.index);
            last.to = point.x;
            last.center = (last.from + last.to) / 2;
        } else {
            clusters.push({
                indices: [point.index],
                from: point.x,
                to: point.x,
                center: point.x,
            });
        }
    }

    return clusters;
}
