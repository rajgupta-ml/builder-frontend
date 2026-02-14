import { IconTextCaption, IconNumbers, IconMail, IconCalendar, IconListDetails, IconCheckbox, IconStar, IconArrowMerge, IconForbid, IconPhoto, IconForms, IconListCheck, IconGitBranch, IconListNumbers, IconMoodSmile, IconInfoCircle, IconShieldLock } from '@tabler/icons-react';

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
    { name: 'condition', label: 'Logic Applied To This Node', type: 'condition', defaultValue: { id: 'root', type: 'group', logicType: 'AND', children: [] }, helperText: 'Define when this node should be shown (Skip Logic)' },
];

export const NODE_DEFINITIONS: NodeDefinition[] = [
    // Inputs
    { 
        type: 'textInput', 
        label: 'Text Answer', 
        description: 'Capture text responses', 
        icon: IconTextCaption, 
        category: 'input',
        properties: [
            ...commonProperties,
            { name: 'placeholder', label: 'Placeholder', type: 'text', placeholder: 'e.g., Type here...', defaultValue: '' },
            { name: 'longAnswer', label: 'Long Answer (Multi-line)', type: 'switch', defaultValue: false },
            { name: 'minChars', label: 'Min Characters', type: 'number', helperText: 'Requires at least this many characters.', defaultValue: 0 },
            { name: 'maxChars', label: 'Max Characters', type: 'number', helperText: 'Limits total characters. 0 or empty for no limit.', defaultValue: 0 },
            { name: 'minWords', label: 'Min Words', type: 'number', helperText: 'Requires at least this many words.', defaultValue: 0 },
            { name: 'maxWords', label: 'Max Words', type: 'number', helperText: 'Limits total words. 0 or empty for no limit.', defaultValue: 0 }
        ]
    },
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
    {
        type: 'multiInput',
        label: 'Multi-Input',
        description: 'Multiple fields in one screen',
        icon: IconForms,
        category: 'input',
        properties: [
            ...commonProperties,
            // We'll treat this as a list of fields where each has a label. 
            // For MVP, we'll use the 'options' type but renaming it conceptually in the UI or strict new type.
            // Let's create a specific property type for this to include more meta data if needed later.
            { 
                name: 'fields', 
                label: 'Input Fields', 
                type: 'options', // Re-using options for now: label = Field Label, value = Field Type (text, email, number) 
                defaultValue: [],
                helperText: 'Value column represents input type (text, number, email)'
            },
            { name: 'minChars', label: 'Min Characters', type: 'number', helperText: 'Applied to all fields.', defaultValue: 0 },
            { name: 'maxChars', label: 'Max Characters', type: 'number', helperText: 'Applied to all fields.', defaultValue: 0 },
            { name: 'minWords', label: 'Min Words', type: 'number', helperText: 'Applied to all fields.', defaultValue: 0 },
            { name: 'maxWords', label: 'Max Words', type: 'number', helperText: 'Applied to all fields.', defaultValue: 0 }
        ]
    },
    { 
        type: 'numberInput', 
        label: 'Number', 
        description: 'Input for numerical values', 
        icon: IconNumbers, 
        category: 'input',
        properties: [
            ...commonProperties,
            { name: 'min', label: 'Minimum Value', type: 'number' },
            { name: 'max', label: 'Maximum Value', type: 'number' }
        ]
    },
    { 
        type: 'emailInput', 
        label: 'Email', 
        description: 'Validate email addresses', 
        icon: IconMail, 
        category: 'input',
        properties: [...commonProperties]
    },
    { 
        type: 'dateInput', 
        label: 'Date Picker', 
        description: 'Select dates from a calendar', 
        icon: IconCalendar, 
        category: 'input',
        properties: [...commonProperties]
    },
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
            ...commonProperties,
            { name: 'items', label: 'Questions/Items', type: 'options', defaultValue: [] },
            { name: 'maxRating', label: 'Max Stars', type: 'number', defaultValue: 5 }
        ]
    },
    {
        type: 'slider',
        label: 'Slider / Scale',
        description: 'Rate multiple items on a scale',
        icon: IconNumbers,
        category: 'choice',
        properties: [
            ...commonProperties,
            { name: 'items', label: 'Items to Rate', type: 'options', defaultValue: [] },
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
                 options: [
                     { label: 'None (Display Only)', value: 'none' },
                     { label: 'Text Question', value: 'text' },
                     { label: 'Slider Rating', value: 'slider' },
                     { label: 'Multiple Choice', value: 'choice' }
                 ],
                 helperText: 'Add a question below this media'
            },
            { 
                name: 'questionLabel', 
                label: 'Question / Text', 
                type: 'text', 
                placeholder: 'Type your text here...',
            },
            { 
                name: 'sliderConfig', 
                label: 'Slider Config (Min-Max)', 
                type: 'text', 
                placeholder: '0-10', 
                visible: (data) => data.interactionType === 'slider'
            },
            { 
                name: 'choices', 
                label: 'Choices', 
                type: 'options', 
                defaultValue: [],
                visible: (data) => data.interactionType === 'choice'
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
                 options: [
                     { label: 'None (Display Only)', value: 'none' },
                     { label: 'Text Question', value: 'text' },
                     { label: 'Slider Rating', value: 'slider' },
                     { label: 'Multiple Choice', value: 'choice' }
                 ]
            },
            { 
                name: 'questionLabel', 
                label: 'Question / Text', 
                type: 'text', 
                placeholder: 'Type your text here...',
            },
            { 
                name: 'sliderConfig', 
                label: 'Slider Config (Min-Max)', 
                type: 'text', 
                placeholder: '0-10', 
                visible: (data) => data.interactionType === 'slider'
            },
            { 
                name: 'choices', 
                label: 'Choices', 
                type: 'options', 
                defaultValue: [],
                visible: (data) => data.interactionType === 'choice'
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
                 options: [
                     { label: 'None (Display Only)', value: 'none' },
                     { label: 'Text Question', value: 'text' },
                     { label: 'Slider Rating', value: 'slider' },
                     { label: 'Multiple Choice', value: 'choice' }
                 ]
            },
            { 
                name: 'questionLabel', 
                label: 'Question / Text', 
                type: 'text', 
                placeholder: 'Type your text here...',
            },
            { 
                name: 'sliderConfig', 
                label: 'Slider Config (Min-Max)', 
                type: 'text', 
                placeholder: '0-10', 
                visible: (data) => data.interactionType === 'slider'
            },
            { 
                name: 'choices', 
                label: 'Choices', 
                type: 'options', 
                defaultValue: [],
                visible: (data) => data.interactionType === 'choice'
            }
        ]
    },

    // Special Inputs
    {
        type: 'zipCodeInput',
        label: 'Accepted Zip Codes',
        description: 'Validate against a list of zip codes',
        icon: IconForms, // Using generic icon
        category: 'input',
        properties: [
            ...commonProperties,
            { name: 'allowedZips', label: 'Allowed Zip Codes', type: 'fileTextarea', placeholder: '10001, 10002, 90210... (Leave empty to allow all)', helperText: 'Validation: Only users entering these zip codes can proceed. Others will be blocked.' }
        ]
    },
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
    {
        type: 'plainText',
        label: 'Info / Text',
        description: 'Display text with a continue button',
        icon: IconInfoCircle,
        category: 'media',
        properties: [
            { name: 'label', label: 'Field Label', type: 'text', placeholder: 'Info Screen' },
            { name: 'description', label: 'Content', type: 'textarea', placeholder: 'Enter your message here...', defaultValue: '' },
            { name: 'buttonLabel', label: 'Button Label', type: 'text', defaultValue: 'Continue' },
            { name: 'condition', label: 'Logic Rule', type: 'condition', defaultValue: { id: 'root', type: 'group', logicType: 'AND', children: [] } }
        ]
    },
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

// Recursive Logic Types
export interface LogicRule {
    id: string; 
    type: 'rule'; 
    field: string;
    subField?: string; 
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
