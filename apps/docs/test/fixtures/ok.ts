/** The shape of a stored thing. */
export type Item = Record<string, unknown>;

/** A box that holds one value. */
export interface Box<T extends object = Item> {
    /** the value in the box */
    value: T;
    /**
     * whether the box is sealed
     * @default false
     */
    sealed?: boolean;
}

/** A name for a number. */
export type Count = number;

/** Wraps a value in a box. */
export function wrap<T extends object>(value: T): Box<T> {
    return { value };
}

/** The colours a box comes in. */
export const COLOURS = {
    /** the colour of the sky */
    BLUE: "blue",
    /** the colour of grass */
    GREEN: "green",
} as const;

/** The label on every box. */
export const LABEL = "box";

/** Two numbers. */
export type Pair = {
    /** the first number */
    first: number;
    /** the second number */
    second: number;
};

/** The sizes a box comes in, with a written type. */
export const SIZES: {
    /** the small size */
    readonly SMALL: 1;
    /** the large size */
    readonly LARGE: 2;
} = { SMALL: 1, LARGE: 2 };
