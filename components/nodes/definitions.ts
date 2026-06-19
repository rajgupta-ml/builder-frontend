import { IconTextCaption, IconNumbers, IconMail, IconCalendar, IconListDetails, IconCheckbox, IconStar, IconArrowMerge, IconForbid, IconPhoto, IconForms, IconListCheck, IconGitBranch, IconListNumbers, IconMoodSmile, IconInfoCircle, IconShieldLock } from '@tabler/icons-react';
import { audioManifest, branchManifest, captchaManifest, cascadingChoiceManifest, consentManifest, dateInputManifest, dropdownManifest, emailInputManifest, emojiRatingManifest, endManifest, imageManifest, matrixChoiceManifest, multiInputManifest, multipleChoiceManifest, numberInputManifest, plainTextManifest, rankingManifest, ratingManifest, singleChoiceManifest, sliderManifest, startManifest, textInputManifest, validationManifest, videoManifest, zipCodeInputManifest } from '@surveystudio/node-registery/builder';
import { featureFlags } from '@/lib/feature-flags';

export type NodeCategory = 'input' | 'choice' | 'logic' | 'media' | 'flow';
export type PropertyType = 'text' | 'textarea' | 'number' | 'switch' | 'select' | 'color' | 'options' | 'condition' | 'stepBuilder' | 'fileTextarea' | 'file' | 'files' | 'emojiOptions';

export interface PropertyField {
    name: string;
    label: string;
    type: PropertyType;
    placeholder?: string;
    helperText?: string;
    defaultValue?: any;
    options?: readonly { label: string, value: string }[]; // For select type
    onBulkAdd?: (options: { label: string, value: string }[]) => void;
    visible?: (data: any) => boolean;
    min?: number;
    max?: number;
}

export interface NodeDefinition {
    type: string;
    label: string;
    description: string;
    icon: React.ElementType;
    category: NodeCategory;
    component?: React.ComponentType<any>;
    properties: PropertyField[];
}

const definitionFromManifest = (
    manifest: Pick<NodeDefinition, 'type' | 'label' | 'description' | 'category' | 'properties'>,
    icon: React.ElementType
): NodeDefinition => ({
    type: manifest.type,
    label: manifest.label,
    description: manifest.description,
    category: manifest.category,
    properties: manifest.properties as PropertyField[],
    icon,
});

// Category Configuration
export const CATEGORY_CONFIG: Record<NodeCategory, { label: string, icon: React.ElementType }> = {
    input: { label: 'Input Fields', icon: IconForms },
    choice: { label: 'Choices', icon: IconListCheck },
    logic: { label: 'Logic', icon: IconGitBranch },
    media: { label: 'Media', icon: IconPhoto },
    flow: { label: 'Flow', icon: IconArrowMerge } // New category for Start/End
};

// Common properties used across multiple nodes
const commonProperties: PropertyField[] = [
    { name: 'label', label: 'Field Label', type: 'text', placeholder: 'e.g., What is your name?' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Helper text for the user', defaultValue: '' },
    { name: 'isPii', label: 'Contains PII', type: 'switch', defaultValue: false, helperText: 'Encrypt this field and exclude it from analytics/export.' },
    { name: 'condition', label: 'When should this question be shown?', type: 'condition', defaultValue: { id: 'root', type: 'group', logicType: 'AND', children: [] }, helperText: 'If no rules are added, this question will always be shown.' },
];

const withBuilderCommonProperties = (
    manifest: Pick<NodeDefinition, 'type' | 'label' | 'description' | 'category' | 'properties'>
) => {
    const manifestProperties = manifest.properties as PropertyField[];
    const propertyByName = new Map(manifestProperties.map((property) => [property.name, property]));

    return {
        ...manifest,
        properties: [
            ...commonProperties.map((property) => propertyByName.get(property.name) || property),
            ...manifestProperties.filter((property) => !commonProperties.some((commonProperty) => commonProperty.name === property.name)),
        ],
    };
};

const MEDIA_INTERACTION_OPTIONS = [
    { label: 'None (Display Only)', value: 'none' },
    ...(!featureFlags.hideMediaInteractionText ? [{ label: 'Text Question', value: 'text' }] : []),
    ...(!featureFlags.hideMediaInteractionRating ? [{ label: 'Slider Rating', value: 'slider' }] : []),
    ...(!featureFlags.hideMediaInteractionChoice ? [{ label: 'Multiple Choice', value: 'choice' }] : [])
];

const withMediaFeatureFlags = (
    manifest: Pick<NodeDefinition, 'type' | 'label' | 'description' | 'category' | 'properties'>
) => {
    const filteredProperties = (manifest.properties as PropertyField[])
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
        properties: filteredProperties,
    };
};

export const NODE_DEFINITIONS: NodeDefinition[] = [
    // Inputs
    definitionFromManifest(withBuilderCommonProperties(textInputManifest), IconTextCaption),
    definitionFromManifest(captchaManifest, IconShieldLock),
    definitionFromManifest(withBuilderCommonProperties(multiInputManifest), IconForms),
    definitionFromManifest(withBuilderCommonProperties(numberInputManifest), IconNumbers),
    definitionFromManifest(withBuilderCommonProperties(emailInputManifest), IconMail),
    definitionFromManifest(withBuilderCommonProperties(dateInputManifest), IconCalendar),

    definitionFromManifest(withBuilderCommonProperties(singleChoiceManifest), IconListDetails),
    definitionFromManifest(withBuilderCommonProperties(rankingManifest), IconListNumbers),
    definitionFromManifest(withBuilderCommonProperties(consentManifest), IconCheckbox),
    definitionFromManifest(withBuilderCommonProperties(multipleChoiceManifest), IconCheckbox),
    definitionFromManifest(withBuilderCommonProperties(dropdownManifest), IconListDetails),
    definitionFromManifest(withBuilderCommonProperties(ratingManifest), IconStar),
    definitionFromManifest(withBuilderCommonProperties(sliderManifest), IconNumbers),


    // Flow
    definitionFromManifest(startManifest, IconArrowMerge),

    // Logic
    definitionFromManifest(branchManifest, IconArrowMerge),
    definitionFromManifest(validationManifest, IconShieldLock),
    definitionFromManifest(endManifest, IconForbid),

    // Media
    definitionFromManifest(withMediaFeatureFlags(imageManifest), IconPhoto),
    definitionFromManifest(withMediaFeatureFlags(videoManifest), IconPhoto),
    definitionFromManifest(withMediaFeatureFlags(audioManifest), IconPhoto),

    // Special Inputs
    definitionFromManifest(withBuilderCommonProperties(zipCodeInputManifest), IconForms),
    definitionFromManifest(withBuilderCommonProperties(matrixChoiceManifest), IconListCheck),
    definitionFromManifest(withBuilderCommonProperties(cascadingChoiceManifest), IconListDetails),
    // New Nodes
    definitionFromManifest(plainTextManifest, IconInfoCircle),
    definitionFromManifest(emojiRatingManifest, IconMoodSmile),
];

export const EU_COUNTRY_CODES = [
    'UK', 'IE', 'FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'CH', 'AT', 'PT', 'DK', 'NO', 'SE', 'FI', 'PL', 'CZ', 'SK', 'HU'
];

export const POSTAL_CODE_COUNTRIES = [
    { label: 'US or EU', value: 'US_EU' },
    { label: 'United States', value: 'US' },
    { label: 'United Kingdom', value: 'UK' },
    { label: 'Canada', value: 'CA' },
    { label: 'Mexico', value: 'MX' },
    { label: 'Brazil', value: 'BR' },
    { label: 'Argentina', value: 'AR' },
    { label: 'Ireland', value: 'IE' },
    { label: 'France', value: 'FR' },
    { label: 'Germany', value: 'DE' },
    { label: 'Spain', value: 'ES' },
    { label: 'Italy', value: 'IT' },
    { label: 'Netherlands', value: 'NL' },
    { label: 'Belgium', value: 'BE' },
    { label: 'Switzerland', value: 'CH' },
    { label: 'Austria', value: 'AT' },
    { label: 'Portugal', value: 'PT' },
    { label: 'Denmark', value: 'DK' },
    { label: 'Norway', value: 'NO' },
    { label: 'Sweden', value: 'SE' },
    { label: 'Finland', value: 'FI' },
    { label: 'Poland', value: 'PL' },
    { label: 'Czech Republic', value: 'CZ' },
    { label: 'Slovakia', value: 'SK' },
    { label: 'Hungary', value: 'HU' },
    { label: 'Japan', value: 'JP' },
    { label: 'China', value: 'CN' },
    { label: 'South Korea', value: 'KR' },
    { label: 'India', value: 'IN' },
    { label: 'Thailand', value: 'TH' },
    { label: 'Singapore', value: 'SG' },
    { label: 'Malaysia', value: 'MY' },
    { label: 'Philippines', value: 'PH' },
    { label: 'Indonesia', value: 'ID' },
    { label: 'Australia', value: 'AU' },
    { label: 'New Zealand', value: 'NZ' },
    { label: 'South Africa', value: 'ZA' },
    { label: 'Nigeria', value: 'NG' },
    { label: 'Egypt', value: 'EG' },
    { label: 'Kenya', value: 'KE' },
    { label: 'United Arab Emirates', value: 'AE' },
    { label: 'Saudi Arabia', value: 'SA' },
    { label: 'Israel', value: 'IL' },
    { label: 'Russia', value: 'RU' },
    { label: 'Ukraine', value: 'UA' },
    { label: 'Turkey', value: 'TR' }
];

// Recursive Logic Types
export interface LogicRule {
    id: string;
    type: 'rule';
    field: string;
    subField?: string;
    compareField?: string;
    operator: string;
    value: any;
    valueType: 'static' | 'variable';
}

export interface LogicGroup {
    id?: string;
    type: 'group';
    logicType: 'AND' | 'OR';
    children: LogicItem[];
}

export type LogicItem = LogicGroup | LogicRule;

// Helper to get initial data with defaults
export const getNodeInitialData = (type: string) => {
    const def = NODE_DEFINITIONS.find(n => n.type === type);
    if (!def) return { label: 'New Node' };

    const defaults: Record<string, any> = {};
    def.properties.forEach(prop => {
        if (prop.defaultValue !== undefined) {
            defaults[prop.name] = prop.defaultValue;
        }
    });

    return {
        label: def.label,
        ...defaults
    };
};

export const getNodeDefinition = (type: string) => NODE_DEFINITIONS.find(n => n.type === type);
