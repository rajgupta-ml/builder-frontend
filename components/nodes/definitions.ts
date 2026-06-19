import { IconTextCaption, IconNumbers, IconMail, IconCalendar, IconListDetails, IconCheckbox, IconStar, IconArrowMerge, IconForbid, IconPhoto, IconForms, IconListCheck, IconGitBranch, IconListNumbers, IconMoodSmile, IconInfoCircle, IconShieldLock } from '@tabler/icons-react';
import { dateInputManifest, emailInputManifest, multiInputManifest, numberInputManifest, plainTextManifest, textInputManifest, zipCodeInputManifest } from '@surveystudio/node-registery/builder';
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
    options?: { label: string, value: string }[]; // For select type
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

export const NODE_DEFINITIONS: NodeDefinition[] = [
    // Inputs
    definitionFromManifest(withBuilderCommonProperties(textInputManifest), IconTextCaption),
    {
        type: 'captcha',
        label: 'Captcha',
        description: 'Verify the user is human using Turnstile',
        icon: IconShieldLock,
        category: 'input',
        properties: [
            ...commonProperties,
            { name: 'sitekey', label: 'Turnstile Site Key', type: 'text', placeholder: '1x00000000000000000000AA', helperText: 'Your Cloudflare Turnstile Site Key' }
        ]
    },
    definitionFromManifest(withBuilderCommonProperties(multiInputManifest), IconForms),
    definitionFromManifest(withBuilderCommonProperties(numberInputManifest), IconNumbers),
    definitionFromManifest(withBuilderCommonProperties(emailInputManifest), IconMail),
    definitionFromManifest(withBuilderCommonProperties(dateInputManifest), IconCalendar),
    {
        type: 'singleChoice',
        label: 'Single Choice',
        description: 'Select one option from a list',
        icon: IconListDetails,
        category: 'choice',
        properties: [
            ...commonProperties,
            { name: 'options', label: 'Options', type: 'options', defaultValue: [] },
            { name: 'bulkOptions', label: 'Bulk Add (one per line)', type: 'textarea', placeholder: 'Option A\nOption B\nOption C...', helperText: 'Paste a list to replace all options above' },
            { name: 'allowOther', label: 'Allow "Other" Option', type: 'switch', defaultValue: false },
            { name: 'otherLabel', label: '"Other" Placeholder', type: 'text', placeholder: 'Other (Please specify)', helperText: 'Label for the open-ended option' },
            { name: 'allowNone', label: 'Allow "None of these"', type: 'switch', defaultValue: false },
            { name: 'noneLabel', label: '"None" Label', type: 'text', placeholder: 'None of these', visible: (data: any) => data.allowNone },
            { name: 'randomizeOptions', label: 'Randomize Options', type: 'switch', defaultValue: false, helperText: 'Shuffle options for every viewer' }
        ]
    },
    {
        type: 'ranking',
        label: 'Ranking',
        description: 'Rank options in order',
        icon: IconListNumbers,
        category: 'choice',
        properties: [
            ...commonProperties,
            { name: 'options', label: 'Items to Rank', type: 'options', defaultValue: [] },
            {
                name: 'displayMode',
                label: 'Display Mode',
                type: 'select',
                options: [
                    { label: 'Drag and Drop', value: 'drag' },
                    { label: 'Select Rank', value: 'select' }
                ],
                defaultValue: 'drag'
            }
        ]
    },
    {
        type: 'consent',
        label: 'Consent',
        description: 'Terms and agreement checkbox',
        icon: IconCheckbox,
        category: 'choice',
        properties: [
            { name: 'label', label: 'Title', type: 'text', placeholder: 'Terms of Service' },
            { name: 'description', label: 'Terms Text', type: 'textarea', placeholder: 'I agree to the terms and conditions...' },
            { name: 'checkboxLabel', label: 'Checkbox Label', type: 'text', placeholder: 'I agree' },
        ]
    },
    {
        type: 'multipleChoice',
        label: 'Multiple Choice',
        description: 'Select multiple options',
        icon: IconCheckbox,
        category: 'choice',
        properties: [
            ...commonProperties,
            { name: 'options', label: 'Options', type: 'options', defaultValue: [] },
            { name: 'bulkOptions', label: 'Bulk Add (one per line)', type: 'textarea', placeholder: 'Option A\nOption B\nOption C...', helperText: 'Paste a list to replace all options above' },
            { name: 'maxChoices', label: 'Maximum Choices', type: 'number', helperText: 'Limit how many options a user can select. Leave empty for no limit.', defaultValue: 0 },
            { name: 'allowOther', label: 'Allow "Other" Option', type: 'switch', defaultValue: false },
            { name: 'otherLabel', label: '"Other" Placeholder', type: 'text', placeholder: 'Other (Please specify)' },
            { name: 'allowNone', label: 'Allow "None of these"', type: 'switch', defaultValue: false },
            { name: 'noneLabel', label: '"None" Label', type: 'text', placeholder: 'None of these', visible: (data: any) => data.allowNone },
            { name: 'randomizeOptions', label: 'Randomize Options', type: 'switch', defaultValue: false, helperText: 'Shuffle options for every viewer' }
        ]
    },
    {
        type: 'dropdown',
        label: 'Dropdown Select',
        description: 'Select from a dropdown menu',
        icon: IconListDetails,
        category: 'choice',
        properties: [
            ...commonProperties,
            { name: 'placeholder', label: 'Placeholder Text', type: 'text', placeholder: 'Select an option...' },
            { name: 'options', label: 'Options', type: 'options', defaultValue: [] },
            { name: 'bulkOptions', label: 'Bulk Add (one per line)', type: 'textarea', placeholder: 'Option A\nOption B\nOption C...', helperText: 'Paste a list to replace all options above' },
            { name: 'searchable', label: 'Searchable', type: 'switch', defaultValue: true },
        ]
    },
    {
        type: 'rating',
        label: 'Rating',
        description: 'Star rating scale',
        icon: IconStar,
        category: 'choice',
        properties: [
            {
                name: 'responseMode',
                label: 'Response Mode',
                type: 'select',
                defaultValue: 'single',
                options: [
                    { label: 'Single Question', value: 'single' },
                    { label: 'Multiple Items', value: 'multi' }
                ]
            },
            ...commonProperties,
            { name: 'items', label: 'Questions/Items', type: 'options', defaultValue: [], visible: (data: any) => data.responseMode === 'multi' },
            { name: 'maxRating', label: 'Max Stars', type: 'number', defaultValue: 5 }
        ]
    },
    {
        type: 'slider',
        label: 'Slider / Scale',
        description: 'Single or multi-item scale',
        icon: IconNumbers,
        category: 'choice',
        properties: [
            {
                name: 'responseMode',
                label: 'Response Mode',
                type: 'select',
                defaultValue: 'single',
                options: [
                    { label: 'Single Question', value: 'single' },
                    { label: 'Multiple Items', value: 'multi' }
                ]
            },
            ...commonProperties,
            { name: 'items', label: 'Items to Rate', type: 'options', defaultValue: [], visible: (data: any) => data.responseMode === 'multi' },
            { name: 'min', label: 'Minimum', type: 'number', defaultValue: 0 },
            { name: 'max', label: 'Maximum', type: 'number', defaultValue: 10 },
            { name: 'step', label: 'Step', type: 'number', defaultValue: 1, min: 0 },
            { name: 'startValue', label: 'Start Value', type: 'number', defaultValue: 5, helperText: 'Initial value of the sliders' }
        ]
    },

    // Flow
    {
        type: 'start',
        label: 'Start',
        description: 'Entry point of the survey',
        icon: IconArrowMerge, // IconPlayerPlay
        category: 'flow',
        properties: [
            { name: 'welcomeMessage', label: 'Welcome Message', type: 'textarea', placeholder: 'e.g., Welcome to our survey! Click below to start.' }
        ] // No properties for Start usually
    },

    // Logic
    {
        type: 'branch',
        label: 'Branch',
        description: 'Split flow based on conditions',
        icon: IconArrowMerge,
        category: 'logic',
        properties: [
            { name: 'condition', label: 'Logic Rule', type: 'condition', defaultValue: { id: 'root', type: 'group', logicType: 'AND', children: [] } }
        ]
    },
    {
        type: 'validation',
        label: 'Validation Gate',
        description: 'Run cross-field validation and split flow',
        icon: IconShieldLock,
        category: 'logic',
        properties: [
            { name: 'label', label: 'Gate Label', type: 'text', placeholder: 'e.g., Age vs DOB Check', defaultValue: 'Validation Gate' },
            { name: 'condition', label: 'Validation Rules', type: 'condition', defaultValue: { id: 'root', type: 'group', logicType: 'AND', children: [] } },
            {
                name: 'outcome',
                label: 'Fail Outcome',
                type: 'select',
                defaultValue: 'security_terminate',
                options: [
                    { label: 'Security Terminate', value: 'security_terminate' },
                    { label: 'Disqualified', value: 'disqualified' },
                    { label: 'Dropped', value: 'dropped' }
                ]
            }
        ]
    },
    {
        type: 'end',
        label: 'End Screen',
        description: 'Terminate the survey flow',
        icon: IconForbid,
        category: 'flow',
        properties: [
            { name: 'message', label: 'Thank You Message', type: 'textarea', placeholder: 'Thank you for completing the survey!' },
            { name: 'redirectUrl', label: 'Redirect URL', type: 'text', placeholder: 'https://...' },
            {
                name: 'outcome',
                label: 'Session Outcome',
                type: 'select',
                defaultValue: 'completed',
                options: [
                    { label: 'Completed', value: 'completed' },
                    { label: 'Disqualified', value: 'disqualified' },
                    { label: 'Quality Terminate', value: 'quality_terminate' },
                    { label: 'Security Terminate', value: 'security_terminate' }
                ]
            }
        ]
    },

    // Media
    {
        type: 'image',
        label: 'Image',
        description: 'Display an image',
        icon: IconPhoto,
        category: 'media',
        properties: [
            { name: 'urls', label: 'Images', type: 'files', defaultValue: [] },
            { name: 'alt', label: 'Alt Text', type: 'text' },
            {
                name: 'interactionType',
                label: 'Enable Interaction',
                type: 'select',
                defaultValue: 'none',
                options: MEDIA_INTERACTION_OPTIONS,
                helperText: 'Add a question below this media'
            },
            {
                name: 'questionLabel',
                label: 'Question / Text',
                type: 'text',
                placeholder: 'Type your text here...',
                visible: (data) => !featureFlags.hideMediaInteractionText && data.interactionType === 'text'
            },
            {
                name: 'sliderConfig',
                label: 'Slider Config (Min-Max)',
                type: 'text',
                placeholder: '0-10',
                visible: (data) => !featureFlags.hideMediaInteractionRating && data.interactionType === 'slider'
            },
            {
                name: 'choices',
                label: 'Choices',
                type: 'options',
                defaultValue: [],
                visible: (data) => !featureFlags.hideMediaInteractionChoice && data.interactionType === 'choice'
            }
        ]
    },
    {
        type: 'video',
        label: 'Video',
        description: 'Embed a video',
        icon: IconPhoto,
        category: 'media',
        properties: [
            { name: 'url', label: 'Video URL', type: 'file', placeholder: 'Upload or paste URL...' },
            { name: 'autoplay', label: 'Autoplay', type: 'switch', defaultValue: false },
            {
                name: 'interactionType',
                label: 'Enable Interaction',
                type: 'select',
                defaultValue: 'none',
                options: MEDIA_INTERACTION_OPTIONS
            },
            {
                name: 'questionLabel',
                label: 'Question / Text',
                type: 'text',
                placeholder: 'Type your text here...',
                visible: (data) => !featureFlags.hideMediaInteractionText && data.interactionType === 'text'
            },
            {
                name: 'sliderConfig',
                label: 'Slider Config (Min-Max)',
                type: 'text',
                placeholder: '0-10',
                visible: (data) => !featureFlags.hideMediaInteractionRating && data.interactionType === 'slider'
            },
            {
                name: 'choices',
                label: 'Choices',
                type: 'options',
                defaultValue: [],
                visible: (data) => !featureFlags.hideMediaInteractionChoice && data.interactionType === 'choice'
            }
        ]
    },
    {
        type: 'audio',
        label: 'Audio',
        description: 'Play an audio clip',
        icon: IconPhoto,
        category: 'media',
        properties: [
            { name: 'url', label: 'Audio URL', type: 'file', placeholder: 'Upload or paste URL...' },
            { name: 'autoplay', label: 'Autoplay', type: 'switch', defaultValue: false },
            {
                name: 'interactionType',
                label: 'Enable Interaction',
                type: 'select',
                defaultValue: 'none',
                options: MEDIA_INTERACTION_OPTIONS
            },
            {
                name: 'questionLabel',
                label: 'Question / Text',
                type: 'text',
                placeholder: 'Type your text here...',
                visible: (data) => !featureFlags.hideMediaInteractionText && data.interactionType === 'text'
            },
            {
                name: 'sliderConfig',
                label: 'Slider Config (Min-Max)',
                type: 'text',
                placeholder: '0-10',
                visible: (data) => !featureFlags.hideMediaInteractionRating && data.interactionType === 'slider'
            },
            {
                name: 'choices',
                label: 'Choices',
                type: 'options',
                defaultValue: [],
                visible: (data) => !featureFlags.hideMediaInteractionChoice && data.interactionType === 'choice'
            }
        ]
    },

    // Special Inputs
    definitionFromManifest(withBuilderCommonProperties(zipCodeInputManifest), IconForms),
    {
        type: 'matrixChoice',
        label: 'Grid / Matrix',
        description: 'Grid of rows and columns',
        icon: IconListCheck,
        category: 'choice',
        properties: [
            ...commonProperties,
            { name: 'rows', label: 'Rows (Questions)', type: 'options', defaultValue: [] },
            { name: 'columns', label: 'Columns (Options)', type: 'options', defaultValue: [] },
            { name: 'multiple', label: 'Allow Multiple', type: 'switch', defaultValue: false }
        ]
    },
    {
        type: 'cascadingChoice',
        label: 'Multi-Step Select',
        description: 'Conditional drill-down options',
        icon: IconListDetails,
        category: 'choice',
        properties: [
            ...commonProperties,
            { name: 'steps', label: 'Steps', type: 'stepBuilder', defaultValue: [] }
        ]
    },
    // New Nodes
    definitionFromManifest(plainTextManifest, IconInfoCircle),
    {
        type: 'emojiRating',
        label: 'Emoji Rating',
        description: 'Rate using emojis',
        icon: IconMoodSmile,
        category: 'choice',
        properties: [
            ...commonProperties,
            {
                name: 'options',
                label: 'Emojis',
                type: 'emojiOptions',
                defaultValue: [
                    { label: 'Angry', value: '😠' },
                    { label: 'Sad', value: '🙁' },
                    { label: 'Neutral', value: '😐' },
                    { label: 'Happy', value: '🙂' },
                    { label: 'Love', value: '😍' }
                ]
            }
        ]
    },
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
