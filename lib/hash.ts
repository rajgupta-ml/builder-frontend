/**
 * Simple hash function for config change detection
 * Uses a fast string hashing algorithm (DJB2)
 */
export function simpleHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
    }
    return (hash >>> 0).toString(16); // Convert to unsigned 32-bit hex
}

/**
 * Calculate config hash for change detection
 */
export function calculateConfigHash(config: {
    runtimeJson: any;
    quotas: any[];
    settings: {
        redirectUrl?: string | null;
        overQuotaUrl?: string | null;
        securityTerminateUrl?: string | null;
        globalQuota?: number | null;
    };
}): string {
    const hashData = {
        runtime: config.runtimeJson,
        quotas: config.quotas,
        settings: config.settings
    };
    
    return simpleHash(JSON.stringify(hashData));
}

/**
 * Calculate individual component hashes for granular change detection
 */
export function calculateComponentHashes(config: {
    runtimeJson: any;
    quotas: any[];
    settings: any;
}) {
    return {
        runtimeHash: simpleHash(JSON.stringify(config.runtimeJson)),
        quotasHash: simpleHash(JSON.stringify(config.quotas)),
        settingsHash: simpleHash(JSON.stringify(config.settings))
    };
}
