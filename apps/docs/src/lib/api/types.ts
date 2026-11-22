/** One member of an interface, an object type or an object constant. */
export interface ApiProperty {
    name: string;
    type: string;
    optional: boolean;
    description: string;
    default?: string;
}

/** One export of the library, as the API reference pages show it. */
export interface ApiEntry {
    name: string;
    kind: "function" | "interface" | "type" | "constant";
    /** function signature, type text, or `interface Options<T extends object = Item>` */
    signature: string;
    description: string;
    /** interface members, object type members, object constant members */
    properties: ApiProperty[];
}

/** Every export of the library by name. */
export type ApiReference = Record<string, ApiEntry>;
