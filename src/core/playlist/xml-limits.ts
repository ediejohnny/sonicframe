/**
 * The ceilings of the XML reader, each an option. The defaults are the ones the most used XML readers
 * settled on after years of attacks (Java's JAXP, tuned down in 2024: depth 100, attributes 200,
 * names 1000); an app's code may raise each up to the most open of them (libxml2's depth 256 and name
 * 50000, JAXP's former attributes 10000), never past it, and lower it to 1 (see `limitOf`). A text
 * that goes past one throws a `RangeError` that names the option and the value used.
 */

import { limitOf, type Limit } from '../shared/limits';

export type ReadXmlOptions = {
    /** The deepest nesting read: 100, from 1 to 256. */
    maxDepth?: number;
    /** The most elements read: 200000, from 1 to 1000000 (a feed of 1000 episodes has about 30000). */
    maxElements?: number;
    /** The most attributes on one element: 200, from 1 to 10000. */
    maxAttributes?: number;
    /** The longest name of an element or an attribute, in characters: 1000, from 1 to 50000. */
    maxNameLength?: number;
};

/** Each ceiling's default, and the least and the most it may be set to. */
export const XML_LIMITS: Readonly<Record<keyof ReadXmlOptions, Limit>> = {
    maxDepth: { value: 100, least: 1, most: 256, whole: true },
    maxElements: { value: 200_000, least: 1, most: 1_000_000, whole: true },
    maxAttributes: { value: 200, least: 1, most: 10_000, whole: true },
    maxNameLength: { value: 1000, least: 1, most: 50_000, whole: true },
};

/** The ceilings `options` asks for; one past its ends throws a `RangeError` (see `limitOf`). */
export function xmlLimits(options: ReadXmlOptions): Required<ReadXmlOptions> {
    const limit = (name: keyof ReadXmlOptions): number =>
        limitOf(name, options[name], XML_LIMITS[name]);

    return {
        maxDepth: limit('maxDepth'),
        maxElements: limit('maxElements'),
        maxAttributes: limit('maxAttributes'),
        maxNameLength: limit('maxNameLength'),
    };
}

/** The error for a text that goes past the ceiling `name`. */
export function pastLimit(
    name: keyof ReadXmlOptions,
    value: number,
): RangeError {
    return new RangeError(`sonicframe: the XML goes past ${name} (${value})`);
}
