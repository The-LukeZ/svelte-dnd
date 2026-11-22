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
