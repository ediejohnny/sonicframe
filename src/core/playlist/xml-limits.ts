/**
 * The ceilings of the XML reader, each an option. The defaults are the ones the most used XML readers
 * settled on after years of attacks (Java's JAXP, tuned down in 2024: depth 100, attributes 200,
 * names 1000); an app's code may raise each up to the most open of them (libxml2's depth 256 and name
 * 50000, JAXP's former attributes 10000), never past it, and lower it to 1. Going past one throws a
 * `RangeError` that names the option and the value used.
 */

import { within } from '../shared/checked';

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

/** Each ceiling's default and the most it may be raised to. */
export const XML_LIMITS: Readonly<
    Record<
        keyof ReadXmlOptions,
        { readonly value: number; readonly most: number }
    >
> = {
    maxDepth: { value: 100, most: 256 },
    maxElements: { value: 200_000, most: 1_000_000 },
    maxAttributes: { value: 200, most: 10_000 },
    maxNameLength: { value: 1000, most: 50_000 },
};

/** The ceilings `options` asks for, each kept from 1 to the most it may be. */
export function xmlLimits(options: ReadXmlOptions): Required<ReadXmlOptions> {
    const limit = (name: keyof ReadXmlOptions): number =>
        within(
            options[name],
            XML_LIMITS[name].value,
            1,
            XML_LIMITS[name].most,
            Math.floor,
        );

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
