import { featureFlags } from '@/lib/feature-flags';

export interface ManifestPropertyLike {
    name: string;
    options?: readonly { label: string; value: string }[];
}

export interface RegistryManifestLike {
    category: string;
    properties: readonly ManifestPropertyLike[];
}

const MEDIA_INTERACTION_OPTIONS = [
    { label: 'None (Display Only)', value: 'none' },
    ...(!featureFlags.hideMediaInteractionText ? [{ label: 'Text Question', value: 'text' }] : []),
    ...(!featureFlags.hideMediaInteractionRating ? [{ label: 'Slider Rating', value: 'slider' }] : []),
    ...(!featureFlags.hideMediaInteractionChoice ? [{ label: 'Multiple Choice', value: 'choice' }] : [])
];

export const applyMediaFeatureFlags = <TManifest extends RegistryManifestLike>(manifest: TManifest): TManifest => {
    if (manifest.category !== 'media') return manifest;

    const properties = manifest.properties
        .filter((property) => {
            if (property.name === 'questionLabel') return !featureFlags.hideMediaInteractionText;
            if (property.name === 'sliderConfig') return !featureFlags.hideMediaInteractionRating;
            if (property.name === 'choices') return !featureFlags.hideMediaInteractionChoice;
            return true;
        })
        .map((property) => {
            if (property.name !== 'interactionType') return property;
            return {
                ...property,
                options: MEDIA_INTERACTION_OPTIONS,
            };
        });

    return {
        ...manifest,
        properties,
    } as TManifest;
};
