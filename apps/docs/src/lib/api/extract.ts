import ts from "typescript";
import type { ApiEntry, ApiProperty, ApiReference } from "./types.ts";

/** Thrown when an export or one of its properties has no TSDoc description. Lists every one, one per line. */
export class ApiDocError extends Error {
    readonly missing: string[];

    constructor(missing: string[]) {
        super(`Missing TSDoc descriptions:\n${missing.join("\n")}`);
        this.name = "ApiDocError";
        this.missing = missing;
    }
}

// strict as the brief asks; bundler resolution so the package exports of svelte (svelte/attachments) resolve.
const COMPILER_OPTIONS: ts.CompilerOptions = {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
};

const TYPE_FORMAT = ts.TypeFormatFlags.NoTruncation;

// Prints type nodes without the TSDoc of their members, which the properties table shows, one member per line.
const printer = ts.createPrinter({ removeComments: true });

/**
 * Reads the public API of a module from its types and TSDoc: every export, followed through re-exports to its
 * declaration.
 * @throws {ApiDocError} when any export or property has no description
 */
export function extractApi(entryFile: string): ApiReference {
    const program = ts.createProgram([entryFile], COMPILER_OPTIONS);
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(entryFile);
    const moduleSymbol = source && checker.getSymbolAtLocation(source);
    if (!moduleSymbol) throw new Error(`Cannot read the module ${entryFile}`);

    const reference: ApiReference = {};
    const missing: string[] = [];
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
        const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
        const entry = readEntry(exported.name, symbol, checker);
        if (!entry.description) missing.push(entry.name);
        for (const property of entry.properties) {
            if (!property.description) missing.push(`${entry.name}.${property.name}`);
        }
        reference[entry.name] = entry;
    }
    if (missing.length > 0) throw new ApiDocError(missing);
    return reference;
}

function readEntry(name: string, symbol: ts.Symbol, checker: ts.TypeChecker): ApiEntry {
    const declarations = symbol.getDeclarations() ?? [];
    const description = describe(symbol, checker);

    // A value and a type that share a name (TRIGGERS, SOURCES) are documented as the value.
    const variable = declarations.find(ts.isVariableDeclaration);
    if (variable) {
        const type = checker.getTypeOfSymbol(symbol);
        const typeNode =
            variable.type ??
            checker.typeToTypeNode(
                type,
                variable,
                ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.MultilineObjectLiterals,
            );
        const typeText = typeNode ? printType(typeNode, variable) : checker.typeToString(type, variable, TYPE_FORMAT);
        const callable = type.getCallSignatures().length > 0;
        // Only an object constant has members to list: a string constant would list the String methods.
        const isObject = !callable && (type.flags & ts.TypeFlags.Object) !== 0;
        return {
            name,
            kind: callable ? "function" : "constant",
            signature: `const ${name}: ${typeText}`,
            description,
            properties: isObject ? readProperties(checker.getPropertiesOfType(type), checker, variable) : [],
        };
    }

    const fn = declarations.find(ts.isFunctionDeclaration);
    if (fn) {
        const signatures = checker.getTypeOfSymbol(symbol).getCallSignatures();
        return {
            name,
            kind: "function",
            signature: signatures
                .map((signature) => `function ${name}${checker.signatureToString(signature, fn, TYPE_FORMAT)}`)
                .join("\n"),
            description,
            properties: [],
        };
    }

    const iface = declarations.find(ts.isInterfaceDeclaration);
    if (iface) {
        return {
            name,
            kind: "interface",
            signature: `interface ${name}${typeParameterText(iface)}`,
            description,
            properties: readProperties(
                checker.getPropertiesOfType(checker.getDeclaredTypeOfSymbol(symbol)),
                checker,
                iface,
            ),
        };
    }

    const alias = declarations.find(ts.isTypeAliasDeclaration);
    if (alias) {
        const properties = ts.isTypeLiteralNode(alias.type)
            ? readProperties(checker.getPropertiesOfType(checker.getTypeAtLocation(alias.type)), checker, alias)
            : [];
        return {
            name,
            kind: "type",
            signature: `type ${name}${typeParameterText(alias)} = ${printType(alias.type, alias)}`,
            description,
            properties,
        };
    }

    throw new Error(`Export ${name} is neither a function, an interface, a type nor a constant`);
}

function readProperties(symbols: ts.Symbol[], checker: ts.TypeChecker, at: ts.Node): ApiProperty[] {
    return symbols.map((symbol) => {
        const declaration = symbol.valueDeclaration ?? symbol.getDeclarations()?.[0];
        const typeNode =
            declaration && "type" in declaration ? (declaration.type as ts.TypeNode | undefined) : undefined;
        const property: ApiProperty = {
            name: symbol.name,
            type: typeNode
                ? printType(typeNode, at)
                : checker.typeToString(checker.getTypeOfSymbol(symbol), at, TYPE_FORMAT),
            optional: (symbol.flags & ts.SymbolFlags.Optional) !== 0,
            description: describe(symbol, checker),
        };
        const fallback = symbol.getJsDocTags(checker).find((tag) => tag.name === "default");
        if (fallback?.text) property.default = ts.displayPartsToString(fallback.text).trim();
        return property;
    });
}

/** A type node's text with the comments inside it removed. */
function printType(node: ts.TypeNode, at: ts.Node): string {
    return printer.printNode(ts.EmitHint.Unspecified, node, at.getSourceFile());
}

/** The type parameters as written, such as `<T extends object = Item>`, or nothing. */
function typeParameterText(declaration: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): string {
    const parameters = declaration.typeParameters;
    return parameters ? `<${parameters.map((parameter) => parameter.getText()).join(", ")}>` : "";
}

function describe(symbol: ts.Symbol, checker: ts.TypeChecker): string {
    return ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();
}
