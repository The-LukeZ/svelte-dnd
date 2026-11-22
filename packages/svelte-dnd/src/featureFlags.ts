// oxlint-disable-next-line no-redeclare -- the value and its union type share a name, as the old enum did
export const FEATURE_FLAG_NAMES = Object.freeze({
    // Default value: false, This flag exists as a workaround for issue 454 (basically a browser bug) - seems like these rect values take time to update when in grid layout. Setting it to true can cause strange behaviour in the REPL for non-grid zones, see issue 470
    USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT: "USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT",
} as const);
export type FEATURE_FLAG_NAMES = (typeof FEATURE_FLAG_NAMES)[keyof typeof FEATURE_FLAG_NAMES];

const featureFlagsMap = {
    [FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT]: false,
};

export function setFeatureFlag(flagName: FEATURE_FLAG_NAMES, flagValue: boolean): void {
    // keys and values are equal
    if (!FEATURE_FLAG_NAMES[flagName as keyof typeof FEATURE_FLAG_NAMES])
        throw new Error(
            `Can't set non existing feature flag ${flagName}! Supported flags: ${Object.keys(FEATURE_FLAG_NAMES)}`,
        );
    featureFlagsMap[flagName] = !!flagValue;
}

export function getFeatureFlag(flagName: FEATURE_FLAG_NAMES): boolean {
    // keys and values are equal
    if (!FEATURE_FLAG_NAMES[flagName as keyof typeof FEATURE_FLAG_NAMES])
        throw new Error(
            `Can't get non existing feature flag ${flagName}! Supported flags: ${Object.keys(FEATURE_FLAG_NAMES)}`,
        );
    return featureFlagsMap[flagName];
}
