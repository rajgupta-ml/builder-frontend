import { IconTextCaption, IconNumbers, IconMail, IconCalendar, IconListDetails, IconCheckbox, IconStar, IconArrowMerge, IconForbid, IconPhoto, IconForms, IconListCheck, IconGitBranch, IconListNumbers, IconMoodSmile, IconInfoCircle, IconShieldLock } from '@tabler/icons-react';
import {
    builderRegistry,
    NODE_CATEGORY_CONFIG,
    resolvePropertyPanel,
    type NodeBuilderIconKey,
    type NodeManifest,
    type ResolvedPropertyPanel,
} from '@surveystudio/node-registery/builder';
import { manifestRegistry, type PropertyFieldType } from '@surveystudio/node-registery/manifest';
import { applyMediaFeatureFlags } from './mediaFeatureFlags';

export type NodeCategory = keyof typeof NODE_CATEGORY_CONFIG;
export type PropertyType = PropertyFieldType;

export interface PropertyField {
    name: string;
    label: string;
    type: PropertyType;
    placeholder?: string;
    helperText?: string;
    defaultValue?: any;
    options?: readonly { label: string, value: string }[];
    onBulkAdd?: (options: { label: string, value: string }[]) => void;
    visible?: (data: any) => boolean;
    min?: number;
    max?: number;
    panel?: { presentation?: "standard" | "disclosure" | "unlabeled" };
}

export interface NodeDefinition {
    type: string;
    label: string;
    description: string;
    icon: React.ElementType;
    category: NodeCategory;
    component?: React.ComponentType<any>;
    properties: PropertyField[];
    defaultData: Record<string, any>;
    propertyPanel: ResolvedPropertyPanel;
}

type RegistryManifest = NodeManifest<any, any>;

const ICON_BY_KEY: Record<NodeBuilderIconKey, React.ElementType> = {
    text: IconTextCaption,
    number: IconNumbers,
    mail: IconMail,
    calendar: IconCalendar,
    listDetails: IconListDetails,
    checkbox: IconCheckbox,
    star: IconStar,
    arrowMerge: IconArrowMerge,
    forbid: IconForbid,
    photo: IconPhoto,
    forms: IconForms,
    listCheck: IconListCheck,
    gitBranch: IconGitBranch,
    listNumbers: IconListNumbers,
    moodSmile: IconMoodSmile,
    infoCircle: IconInfoCircle,
    shieldLock: IconShieldLock,
};

// Category Configuration
export const CATEGORY_CONFIG: Record<NodeCategory, { label: string, icon: React.ElementType }> = Object.fromEntries(
    (Object.entries(NODE_CATEGORY_CONFIG) as Array<[NodeCategory, { label: string; iconKey: NodeBuilderIconKey }]>).map(([category, config]) => [
        category,
        { label: config.label, icon: ICON_BY_KEY[config.iconKey] },
    ])
) as Record<NodeCategory, { label: string, icon: React.ElementType }>;


const definitionFromManifest = (rawManifest: RegistryManifest): NodeDefinition => {
    const manifest = applyMediaFeatureFlags(rawManifest);
    const builder = (builderRegistry as Record<string, { iconKey?: NodeBuilderIconKey }>)[manifest.type];
    const iconKey = (builder?.iconKey ?? NODE_CATEGORY_CONFIG[manifest.category].iconKey) as NodeBuilderIconKey;

    return {
        type: manifest.type,
        label: manifest.label,
        description: manifest.description,
        category: manifest.category,
        properties: manifest.properties as PropertyField[],
        defaultData: manifest.defaultData as Record<string, any>,
        propertyPanel: resolvePropertyPanel(manifest),
        icon: ICON_BY_KEY[iconKey],
    };
};

// Conditional flow now lives on question nodes instead of a standalone skip node.
export const NODE_DEFINITIONS: NodeDefinition[] = Object.values(manifestRegistry as Record<string, RegistryManifest>)
    .filter((manifest) => manifest.type !== 'skip')
    .map(definitionFromManifest);




// Helper to get initial data from the registry manifest defaults.
export const getNodeInitialData = (type: string) => {
    const def = NODE_DEFINITIONS.find(n => n.type === type);
    if (!def) return { label: 'New Node' };

    return {
        ...def.defaultData,
        label: def.defaultData.label ?? def.label,
    };
};

export const getNodeDefinition = (type: string) => NODE_DEFINITIONS.find(n => n.type === type);
