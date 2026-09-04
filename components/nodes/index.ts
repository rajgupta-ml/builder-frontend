import { createElement } from 'react';
import type React from 'react';
import { Handle, Position, useReactFlow, type NodeProps, type NodeTypes } from '@xyflow/react';
import {
    IconArrowMerge,
    IconCalendar,
    IconCheckbox,
    IconChevronRight,
    IconForbid,
    IconForms,
    IconGitBranch,
    IconInfoCircle,
    IconListCheck,
    IconListDetails,
    IconListNumbers,
    IconMail,
    IconMoodSmile,
    IconNumbers,
    IconPhoto,
    IconPlayerPlay,
    IconShieldLock,
    IconShieldCheck,
    IconStar,
    IconTextCaption,
    IconTrash,
    IconMapPin,
    IconCheck,
    IconEye,
    IconRoute,
    IconX,
} from '@tabler/icons-react';
import { builderRegistry } from '@surveystudio/node-registery/builder';
import type { NodeBuilder } from '@surveystudio/node-registery/builder';
import BaseNode from './BaseNode';
import { cn } from '@/lib/utils';
import { NODE_DEFINITIONS } from './definitions';
import type { FlowRuleInspection } from '@/lib/skipMigration';
import type { FlowRelationshipItem, NodeFlowRelationships } from '@/lib/flowRelationships';

const e = createElement;

type RegistryBuilderEntry = NodeBuilder;

const ICONS: Record<string, React.ElementType> = {
    textInput: IconTextCaption,
    numberInput: IconNumbers,
    emailInput: IconMail,
    dateInput: IconCalendar,
    multiInput: IconForms,
    zipCodeInput: IconMapPin,
    singleChoice: IconListDetails,
    multipleChoice: IconCheckbox,
    dropdown: IconListDetails,
    ranking: IconListNumbers,
    rating: IconStar,
    slider: IconNumbers,
    matrixChoice: IconListCheck,
    cascadingChoice: IconListDetails,
    consent: IconCheckbox,
    captcha: IconShieldLock,
    image: IconPhoto,
    video: IconPhoto,
    audio: IconPhoto,
    plainText: IconInfoCircle,
    emojiRating: IconMoodSmile,
    start: IconPlayerPlay,
    end: IconForbid,
    branch: IconGitBranch,
    skip: IconGitBranch,
    validation: IconShieldLock,
    merge: IconArrowMerge,
    branchOut: IconGitBranch,
};

const COLORS: Record<string, string> = {
    singleChoice: 'bg-orange-500',
    multipleChoice: 'bg-orange-500',
    dropdown: 'bg-orange-500',
    zipCodeInput: 'bg-indigo-500',
    matrixChoice: 'bg-purple-500',
    cascadingChoice: 'bg-purple-500',
    image: 'bg-indigo-500',
    video: 'bg-indigo-500',
    audio: 'bg-indigo-500',
    merge: 'bg-sky-500',
    skip: 'bg-rose-500',
    branchOut: 'bg-cyan-600',
};

const getBuilder = (type: string): RegistryBuilderEntry | undefined => {
    return builderRegistry[type as keyof typeof builderRegistry] as unknown as RegistryBuilderEntry | undefined;
};

// Hides options with a blank label from the canvas preview only — the
// underlying node data (properties panel, saved survey, runner) is untouched.
const withVisibleOptionsOnly = (data: Record<string, unknown>): Record<string, unknown> => {
    if (!Array.isArray(data.options)) return data;
    const visibleOptions = (data.options as Array<Record<string, unknown>>).filter(
        (option) => String(option?.label ?? '').trim() !== ''
    );
    if (visibleOptions.length === data.options.length) return data;
    return { ...data, options: visibleOptions };
};

const renderCanvas = (props: NodeProps<any>) => {
    const entry = getBuilder(String(props.type || ''));
    const CanvasComponent = entry?.CanvasComponent;

    if (!CanvasComponent) {
        return e('div', { className: 'text-xs text-muted-foreground italic' }, 'No preview available');
    }

    return e(CanvasComponent as React.ComponentType<any>, {
        id: props.id,
        type: String(props.type || ''),
        data: withVisibleOptionsOnly(props.data as Record<string, unknown>),
        selected: props.selected,
    });
};

const countVisibilityRules = (value: unknown): number => {
    if (!value || typeof value !== 'object') return 0;
    const item = value as { type?: string; field?: unknown; children?: unknown[] };
    if (item.type === 'rule' || (typeof item.field === 'string' && item.field)) return 1;
    return Array.isArray(item.children)
        ? item.children.reduce<number>((total, child) => total + countVisibilityRules(child), 0)
        : 0;
};

type RelationshipBadgeProps = {
    kind: 'visibility' | 'jump';
    prefix: string;
    direction: '←' | '→';
    relatedNoun: 'sources' | 'targets';
    ruleNoun: 'conditions' | 'jump rules';
    items: FlowRelationshipItem[];
    totalRuleCount: number;
    missingCount?: number;
    missingLabel: string;
    onInspect?: (inspection: FlowRuleInspection | null) => void;
};

type RelationshipBadgeConfig = RelationshipBadgeProps & { badgeKey: string };

const RelationshipBadge = ({
    kind,
    prefix,
    direction,
    relatedNoun,
    ruleNoun,
    items,
    totalRuleCount,
    missingCount = 0,
    missingLabel,
    onInspect,
}: RelationshipBadgeProps) => {
    if (items.length === 0 && missingCount === 0) return null;
    const Icon = kind === 'visibility' ? IconEye : IconGitBranch;
    const firstLabel = items[0]?.nodeLabel || missingLabel;
    const extraNodeCount = Math.max(0, items.length - 1);
    const suffix = extraNodeCount > 0
        ? `+${extraNodeCount} ${relatedNoun}`
        : totalRuleCount > 1
            ? `· ${totalRuleCount} rules`
            : missingCount > 0 && items.length > 0
                ? `· ${missingCount} missing`
                : '';
    const title = [
        `${prefix} ${items.map((item) => item.nodeLabel).join(', ') || missingLabel}`,
        `${totalRuleCount} ${ruleNoun}`,
        missingCount > 0 ? `${missingCount} unresolved` : '',
    ].filter(Boolean).join(' · ');
    const themeClass = kind === 'visibility'
        ? 'border-cyan-200 bg-cyan-50 text-cyan-800'
        : 'border-violet-200 bg-violet-50 text-violet-700';

    const stopCanvasEvent = (event: React.SyntheticEvent) => event.stopPropagation();
    return e(
        'details',
        {
            className: 'nodrag nopan relative w-full min-w-0',
            onClick: stopCanvasEvent,
            onPointerDown: stopCanvasEvent,
            onToggle: (event: React.SyntheticEvent<HTMLDetailsElement>) => {
                onInspect?.(event.currentTarget.open ? items[0]?.inspection || null : null);
            },
        },
        e(
            'summary',
            {
                className: cn(
                    'flex w-full min-w-0 cursor-pointer list-none items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold outline-none transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden',
                    themeClass,
                ),
                title,
                'aria-label': `${title}. Open relationship list`,
            },
            e(Icon, { size: 10, className: 'shrink-0' }),
            e('span', { className: 'shrink-0' }, prefix),
            e('span', { className: 'shrink-0 opacity-70' }, direction),
            e('span', { className: 'min-w-0 flex-1 truncate text-left', title: firstLabel }, firstLabel),
            suffix ? e('span', { className: 'shrink-0 font-semibold opacity-80' }, suffix) : null,
            e(IconChevronRight, { size: 9, className: 'shrink-0 opacity-60' }),
        ),
        e(
            'div',
            {
                className: 'absolute left-[calc(100%+6px)] top-0 z-[1100] w-64 rounded-lg border border-border bg-card p-2 text-foreground shadow-xl',
                role: 'list',
                'aria-label': `${prefix} relationships`,
            },
            e(
                'div',
                { className: 'mb-1.5 flex items-center justify-between gap-2 px-1' },
                e('span', { className: 'text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground' }, prefix),
                e('span', { className: 'text-[9px] font-semibold text-muted-foreground' }, `${totalRuleCount} ${ruleNoun}`),
            ),
            ...items.map((item) => e(
                'button',
                {
                    key: `${prefix}-${item.nodeId}`,
                    type: 'button',
                    role: 'listitem',
                    className: 'nodrag nopan mb-1 flex w-full min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background px-2 py-1.5 text-left transition-colors last:mb-0 hover:border-primary/30 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    onMouseEnter: () => onInspect?.(item.inspection),
                    onMouseLeave: () => onInspect?.(null),
                    onFocus: () => onInspect?.(item.inspection),
                    onBlur: () => onInspect?.(null),
                    onClick: (event: React.MouseEvent) => {
                        event.stopPropagation();
                        onInspect?.(item.inspection);
                    },
                    title: item.details.join('\n'),
                },
                e('span', { className: cn('h-1.5 w-1.5 shrink-0 rounded-full', kind === 'visibility' ? 'bg-cyan-500' : 'bg-violet-500') }),
                e(
                    'span',
                    { className: 'min-w-0 flex-1' },
                    e('span', { className: 'block truncate text-[10px] font-semibold', title: item.nodeLabel }, `${direction} ${item.nodeLabel}`),
                    e('span', { className: 'block truncate text-[9px] text-muted-foreground' }, item.ruleCount === 1 ? `1 ${ruleNoun.replace(/s$/, '')}` : `${item.ruleCount} ${ruleNoun}`),
                ),
            )),
            missingCount > 0
                ? e(
                    'div',
                    { className: 'flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[9px] font-semibold text-amber-800' },
                    e('span', { className: 'h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500' }),
                    `${missingCount} ${missingLabel.toLowerCase()}`,
                )
                : null,
        ),
    );
};

const FlowRulesBadges = (props: NodeProps<any>) => {
    const data = props.data as Record<string, unknown>;
    if (data.__pathAnalysis) return null;
    const relationships = data.__flowRelationships as NodeFlowRelationships | undefined;
    const onInspect = data.__onInspectFlowRule as ((inspection: FlowRuleInspection | null) => void) | undefined;

    // Keep the old summary available in isolated node previews where canvas-level
    // mirrored relationship metadata has not been injected.
    if (!relationships) {
        const skips = Array.isArray(data.skips)
            ? data.skips.filter((rule) => rule && typeof rule === 'object')
            : [];
        const visibilityRuleCount = countVisibilityRules(data.condition);
        if (skips.length === 0 && visibilityRuleCount === 0) return null;
        return e(
            'div',
            { className: 'mt-2 flex flex-wrap items-center gap-1' },
            visibilityRuleCount > 0
                ? e('span', { className: 'inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[9px] font-bold text-cyan-800' }, e(IconEye, { size: 10 }), `${visibilityRuleCount} conditions`)
                : null,
            skips.length > 0
                ? e('span', { className: 'inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-bold text-violet-700' }, e(IconGitBranch, { size: 10 }), `${skips.length} ${skips.length === 1 ? 'jump' : 'jumps'}`)
                : null,
        );
    }

    const visibilityTargetRuleCount = relationships.visibilityTo.reduce((total, item) => total + item.ruleCount, 0);
    const badgeConfigs: RelationshipBadgeConfig[] = [
        {
            badgeKey: 'visibility-from', kind: 'visibility', prefix: 'Depends on', direction: '←', relatedNoun: 'sources', ruleNoun: 'conditions',
            items: relationships.visibilityFrom, totalRuleCount: relationships.visibilityRuleCount,
            missingCount: relationships.unresolvedVisibilityRuleCount, missingLabel: 'Missing source', onInspect,
        },
        {
            badgeKey: 'visibility-to', kind: 'visibility', prefix: 'Controls', direction: '→', relatedNoun: 'targets', ruleNoun: 'conditions',
            items: relationships.visibilityTo, totalRuleCount: visibilityTargetRuleCount,
            missingLabel: 'Missing target', onInspect,
        },
        {
            badgeKey: 'jumps-to', kind: 'jump', prefix: 'Jumps to', direction: '→', relatedNoun: 'targets', ruleNoun: 'jump rules',
            items: relationships.jumpsTo, totalRuleCount: relationships.outgoingJumpRuleCount,
            missingCount: relationships.unresolvedJumpRuleCount, missingLabel: 'Target not set', onInspect,
        },
        {
            badgeKey: 'jumps-from', kind: 'jump', prefix: 'Jumped from', direction: '←', relatedNoun: 'sources', ruleNoun: 'jump rules',
            items: relationships.jumpsFrom, totalRuleCount: relationships.incomingJumpRuleCount,
            missingLabel: 'Missing source', onInspect,
        },
    ];
    const visibleBadgeConfigs = badgeConfigs.filter((badge) => badge.items.length > 0 || (badge.missingCount || 0) > 0);
    if (visibleBadgeConfigs.length === 0) return null;

    return e(
        'div',
        { className: 'nodrag nopan mt-2 flex min-w-0 flex-col items-stretch gap-1' },
        ...visibleBadgeConfigs.map(({ badgeKey, ...badge }) => e(RelationshipBadge, { ...badge, key: badgeKey })),
    );
};

const qualityPolicyIsActive = (source: unknown) => {
    if (!source || typeof source !== 'object') return false;
    return (source as Record<string, unknown>).openEndPolicyMode !== 'disabled';
};

const QualityControlBadge = (props: NodeProps<any>) => {
    const type = String(props.type || '');
    const data = props.data as Record<string, unknown>;
    const resolved = data.__qualityControl as {
        resolved?: boolean;
        enabled?: boolean;
        activeFields?: number;
        totalFields?: number;
    } | undefined;
    let state: 'on' | 'off' | 'auto' | null = null;
    let label: string | null = null;
    let title: string | null = null;

    if (type === 'textInput') {
        if (resolved?.resolved) {
            state = resolved.enabled ? 'on' : 'off';
        } else {
            state = qualityPolicyIsActive(data) ? 'auto' : 'off';
        }
        label = state === 'on' ? 'Quality on' : state === 'off' ? 'Quality off' : 'Quality auto';
        title = state === 'on'
            ? 'The effective open-end quality policy is enabled'
            : state === 'off'
                ? 'The effective open-end quality policy is disabled'
                : 'Auto-detect is configured; open the Quality panel to resolve its effective status';
    }

    if (type === 'multiInput') {
        const fields = Array.isArray(data.fields)
            ? data.fields.filter((field) => field && typeof field === 'object')
            : [];
        if (fields.length > 0) {
            const configuredFields = fields.filter(qualityPolicyIsActive).length;
            if (resolved?.resolved) {
                const activeFields = resolved.activeFields || 0;
                state = activeFields > 0 ? 'on' : 'off';
                label = activeFields > 0 ? `Quality on · ${activeFields}/${fields.length}` : 'Quality off';
                title = `The effective quality policy is enabled for ${activeFields} of ${fields.length} fields`;
            } else {
                state = configuredFields > 0 ? 'auto' : 'off';
                label = state === 'auto' ? `Quality auto · ${configuredFields}/${fields.length}` : 'Quality off';
                title = state === 'auto'
                    ? 'Per-field auto-detect is configured; open the Quality panel to resolve effective status'
                    : 'Quality control is disabled for every field';
            }
        }
    }

    if (!label) return null;

    return e(
        'div',
        { className: 'nodrag nopan mt-2 flex flex-wrap items-center gap-1' },
        e(
            'span',
            {
                className: cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wide',
                    state === 'on' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                    state === 'off' && 'border-border bg-muted text-muted-foreground',
                    state === 'auto' && 'border-primary/20 bg-primary/5 text-primary',
                ),
                title: title || undefined,
            },
            e(IconShieldCheck, { size: 10, strokeWidth: 2.2 }),
            label,
        ),
    );
};

type PathAnalysisNodeState = {
    answer?: string;
    decisions?: string[];
    active?: boolean;
    skipped?: boolean;
};

const PathAnalysisState = ({ data, compact = false }: { data: any; compact?: boolean }) => {
    const state = data?.__pathAnalysis as PathAnalysisNodeState | undefined;
    if (!state?.active && !state?.skipped && !state?.answer && !state?.decisions?.length) return null;

    if (state.skipped) {
        return e(
            'div',
            { className: 'nodrag nopan mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-amber-950 shadow-sm' },
            e('p', { className: 'text-[8px] font-bold uppercase tracking-[0.08em] text-amber-700' }, 'Skipped'),
            e('p', { className: 'mt-0.5 text-[9px] font-semibold leading-3 text-amber-900' }, 'Show condition was false'),
        );
    }

    if (state.active) {
        return e(
            'div',
            { className: 'nodrag nopan mt-2 flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-sky-900 shadow-sm' },
            e('span', { className: 'h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-sky-500' }),
            e('p', { className: 'truncate text-[9px] font-bold' }, 'Waiting for answer · Use Flow Tester below'),
        );
    }

    return e(
        'div',
        {
            className: cn(
                'nodrag nopan rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm',
                compact ? 'mt-2 px-2 py-1' : 'mt-2 px-2.5 py-2',
            ),
        },
        state.answer
            ? e(
                'div',
                { className: 'min-w-0' },
                e('p', { className: 'text-[8px] font-bold uppercase tracking-[0.08em] text-emerald-700' }, 'Answer'),
                e('p', { className: 'truncate text-[11px] font-bold leading-4 text-emerald-950', title: state.answer }, state.answer),
            )
            : null,
        ...(state.decisions || []).map((decision, index) => e(
            'p',
            {
                key: `${decision}-${index}`,
                className: cn(
                    'flex items-center gap-1 truncate font-semibold text-emerald-800',
                    state.answer ? 'mt-1 border-t border-emerald-200 pt-1 text-[9px]' : 'text-[10px]',
                ),
                title: decision,
            },
            e(IconRoute, { size: 10, className: 'shrink-0' }),
            decision,
        )),
    );
};

const CommonRegistryNode = (props: NodeProps<any>) => {
    const type = String(props.type || '');
    const Icon = ICONS[type] || IconTextCaption;

    return e(
        BaseNode,
        {
            id: props.id,
            selected: props.selected,
            data: props.data,
            icon: Icon,
            color: COLORS[type],
            handles: { source: Position.Bottom, target: Position.Top },
        },
        renderCanvas(props),
        e(QualityControlBadge, props),
        e(PathAnalysisState, { data: props.data }),
        e(FlowRulesBadges, props),
    );
};

const StartRegistryNode = (props: NodeProps<any>) => e(
    'div',
    {
        className: cn(
            'group relative px-6 py-3 rounded-full bg-green-500 text-white shadow-md border-2 transition-all duration-200 flex items-center gap-2 min-w-[120px] justify-center',
            props.selected ? 'border-green-700 ring-4 ring-green-500/20 shadow-xl' : 'border-green-600 hover:border-green-700',
        ),
    },
    e(IconPlayerPlay, { size: 16, fill: 'white' }),
    renderCanvas(props),
    e(Handle, {
        type: 'source',
        position: Position.Bottom,
        className: 'bg-green-600 border-2 border-white',
        style: { width: 10, height: 10 },
    }),
);

const EndRegistryNode = (props: NodeProps<any>) => {
    const { deleteElements } = useReactFlow();
    const handleDelete = (event: React.MouseEvent) => {
        event.stopPropagation();
        deleteElements({ nodes: [{ id: props.id }] });
    };

    return e(
        'div',
        {
            className: cn(
                'group relative px-6 py-3 rounded-full bg-destructive text-destructive-foreground shadow-md border-2 transition-all duration-200 flex items-center gap-2 min-w-[120px] justify-center',
                props.selected ? 'border-red-800 ring-4 ring-red-500/20 shadow-xl' : 'border-red-700 hover:border-red-800',
            ),
        },
        e(
            'span',
            {
                className: 'absolute left-1/2 bottom-full mb-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-red-700 bg-white px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm',
                title: `Node ID: ${props.id}`,
            },
            `${props.data.__endSequence ?? '?'}. End`,
        ),
        e(Handle, {
            type: 'target',
            position: Position.Top,
            className: 'bg-red-700 border-2 border-white',
            style: { width: 10, height: 10 },
        }),
        e(IconForbid, { size: 16 }),
        renderCanvas(props),
        e('div', { className: 'absolute left-1/2 top-full w-[220px] -translate-x-1/2 text-left' }, e(FlowRulesBadges, props)),
        props.selected
            ? e('button', {
                onClick: handleDelete,
                className: 'absolute -top-2 -right-2 p-1 bg-white text-destructive rounded-full shadow-sm hover:scale-110 transition-transform border border-border',
            }, e(IconTrash, { size: 10 }))
            : null,
    );
};

const BranchRegistryNode = (props: NodeProps<any>) => {
    const { deleteElements } = useReactFlow();
    const isValidation = props.type === 'validation';
    const handleDelete = (event: React.MouseEvent) => {
        event.stopPropagation();
        deleteElements({ nodes: [{ id: props.id }] });
    };

    return e(
        'div',
        {
            className: cn(
                'group relative w-16 h-16 rounded-full flex items-center justify-center bg-card border-2 shadow-sm transition-all duration-200',
                isValidation
                    ? (props.selected ? 'border-amber-500 ring-4 ring-amber-500/10 shadow-xl' : 'border-amber-500 hover:border-amber-600')
                    : (props.selected ? 'border-purple-500 ring-4 ring-purple-500/10 shadow-xl' : 'border-purple-500 hover:border-purple-600'),
            ),
        },
        e(Handle, {
            type: 'target',
            position: Position.Top,
            className: 'bg-muted-foreground border-2 border-background',
            style: { width: 10, height: 10 },
        }),
        isValidation
            ? e(IconShieldLock, { size: 22, className: 'text-amber-600' })
            : e(IconArrowMerge, { size: 24, className: 'text-purple-500' }),
        e(Handle, {
            type: 'source',
            id: 'true',
            position: Position.Right,
            className: 'bg-green-500 border-2 border-background',
            style: { width: 10, height: 10 },
        }),
        e('div', { className: 'absolute -right-8 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-600 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity' }, 'TRUE'),
        e(Handle, {
            type: 'source',
            id: 'false',
            position: Position.Left,
            className: 'bg-red-500 border-2 border-background',
            style: { width: 10, height: 10 },
        }),
        e('div', { className: 'absolute -left-9 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity' }, 'FALSE'),
        e('div', { className: 'absolute left-1/2 top-[calc(100%+6px)] w-max max-w-[150px] -translate-x-1/2' },
            e(PathAnalysisState, { data: props.data, compact: true }),
        ),
        props.selected
            ? e('button', {
                onClick: handleDelete,
                className: 'absolute -top-6 left-1/2 -translate-x-1/2 p-1 bg-destructive text-destructive-foreground rounded-full shadow-lg hover:scale-110 transition-transform',
            }, e(IconTrash, { size: 12 }))
            : null,
    );
};

const ValidationRegistryNode = (props: NodeProps<any>) => {
    const { deleteElements } = useReactFlow();
    const handleDelete = (event: React.MouseEvent) => {
        event.stopPropagation();
        deleteElements({ nodes: [{ id: props.id }] });
    };

    return e(
        'div',
        {
            className: cn(
                'group relative w-[148px] rounded-xl bg-card border-2 px-3 py-2 shadow-sm transition-all duration-200',
                props.selected ? 'border-amber-500 ring-4 ring-amber-500/10 shadow-xl' : 'border-amber-500 hover:border-amber-600',
            ),
        },
        e(Handle, {
            type: 'target',
            position: Position.Top,
            className: 'bg-muted-foreground border-2 border-background',
            style: { width: 10, height: 10 },
        }),
        e('div', { className: 'flex items-center gap-2' },
            e('div', { className: 'h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center' }, e(IconShieldLock, { size: 16, className: 'text-amber-700' })),
            renderCanvas(props),
        ),
        e(PathAnalysisState, { data: props.data, compact: true }),
        e(Handle, {
            type: 'source',
            id: 'true',
            position: Position.Right,
            className: 'bg-green-500 border-2 border-background',
            style: { width: 10, height: 10 },
        }),
        e('div', { className: 'absolute -right-5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-green-500 text-white border-2 border-background shadow-sm flex items-center justify-center pointer-events-none' }, e(IconCheck, { size: 10, strokeWidth: 3 })),
        e('div', { className: 'absolute -right-9 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-600 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity' }, 'PASS'),
        e(Handle, {
            type: 'source',
            id: 'false',
            position: Position.Left,
            className: 'bg-red-500 border-2 border-background',
            style: { width: 10, height: 10 },
        }),
        e('div', { className: 'absolute -left-5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-red-500 text-white border-2 border-background shadow-sm flex items-center justify-center pointer-events-none' }, e(IconX, { size: 10, strokeWidth: 3 })),
        e('div', { className: 'absolute -left-8 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity' }, 'FAIL'),
        props.selected
            ? e('button', {
                onClick: handleDelete,
                className: 'absolute -top-5 right-1 p-1 bg-destructive text-destructive-foreground rounded-full shadow-lg hover:scale-110 transition-transform',
            }, e(IconTrash, { size: 12 }))
            : null,
    );
};


const routeRecords = (data: Record<string, unknown>) => (
    Array.isArray(data?.routes)
        ? (data.routes as any[]).filter((route) => route && typeof route === 'object')
        : []
);

const routeId = (route: any, index: number) => String(route?.id || `path-${index + 1}`);
const routeLabel = (route: any, index: number) => String(route?.label || `Path ${index + 1}`);

const MergeRegistryNode = (props: NodeProps<any>) => {
    const { deleteElements } = useReactFlow();
    const handleDelete = (event: React.MouseEvent) => {
        event.stopPropagation();
        deleteElements({ nodes: [{ id: props.id }] });
    };
    const inputSlots = ['in-a', 'in-b', 'in-c', 'in-d'];

    return e(
        'div',
        {
            className: cn(
                'group relative min-h-[78px] w-[232px] rounded-lg bg-card border-2 shadow-sm transition-all duration-200 flex items-center justify-start gap-3 px-3 py-2',
                props.selected ? 'border-sky-500 ring-4 ring-sky-500/10 shadow-xl' : 'border-sky-500 hover:border-sky-600',
            ),
        },
        ...inputSlots.map((slot, index) => e(Handle, {
            key: slot,
            type: 'target',
            id: slot,
            position: Position.Top,
            className: 'bg-sky-500 border-2 border-background',
            style: {
                width: 10,
                height: 10,
                top: 0,
                left: `${18 + index * 21}%`,
                transform: 'translate(-50%, -50%)',
            },
        })),
        e('div', { className: 'h-9 w-9 shrink-0 rounded-md bg-sky-100 flex items-center justify-center' }, e(IconArrowMerge, { size: 18, className: 'text-sky-700' })),
        e('div', { className: 'min-w-0 flex-1' }, renderCanvas(props)),
        e(Handle, {
            type: 'source',
            position: Position.Bottom,
            className: 'bg-sky-600 border-2 border-background',
            style: { width: 10, height: 10 },
        }),
        props.selected
            ? e('button', {
                onClick: handleDelete,
                className: 'absolute -top-5 right-1 p-1 bg-destructive text-destructive-foreground rounded-full shadow-lg hover:scale-110 transition-transform',
            }, e(IconTrash, { size: 12 }))
            : null,
    );
};

const BranchOutRegistryNode = (props: NodeProps<any>) => {
    const { deleteElements } = useReactFlow();
    const handleDelete = (event: React.MouseEvent) => {
        event.stopPropagation();
        deleteElements({ nodes: [{ id: props.id }] });
    };
    const routes = routeRecords(props.data as Record<string, unknown>);
    const visibleRoutes = routes.length ? routes : [{ id: 'path-a', label: 'Path A' }];
    const fallbackLabel = String((props.data as any)?.fallbackLabel || 'Otherwise');
    const outputPorts = [
        ...visibleRoutes.map((route, index) => ({ id: routeId(route, index), kind: 'route' as const })),
        { id: 'fallback', kind: 'fallback' as const },
    ];

    return e(
        'div',
        {
            className: cn(
                'group relative w-[272px] rounded-lg bg-card border-2 px-3 py-2 shadow-sm transition-all duration-200',
                props.selected ? 'border-cyan-600 ring-4 ring-cyan-500/10 shadow-xl' : 'border-cyan-500 hover:border-cyan-600',
            ),
        },
        e(Handle, {
            type: 'target',
            position: Position.Top,
            className: 'bg-muted-foreground border-2 border-background',
            style: { width: 10, height: 10 },
        }),
        e('div', { className: 'flex items-center gap-2 border-b border-border/70 pb-2' },
            e('div', { className: 'h-8 w-8 shrink-0 rounded-md bg-cyan-100 flex items-center justify-center' }, e(IconGitBranch, { size: 17, className: 'text-cyan-700' })),
            e('div', { className: 'min-w-0 flex-1' }, renderCanvas(props)),
        ),
        e('div', { className: 'mt-2 space-y-1.5' },
            ...visibleRoutes.map((route, index) => e(
                'div',
                {
                    key: routeId(route, index),
                    className: 'relative flex items-center gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-[10px] font-semibold text-cyan-900',
                },
                e('span', { className: 'h-2 w-2 rounded-full bg-cyan-500 shrink-0' }),
                e('span', { className: 'truncate', title: routeLabel(route, index) }, routeLabel(route, index)),
            )),
            e(
                'div',
                { className: 'relative flex items-center gap-2 rounded-md border border-slate-300 bg-muted/40 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground' },
                e('span', { className: 'h-2 w-2 rounded-full bg-muted-foreground/70 shrink-0' }),
                e('span', { className: 'truncate', title: fallbackLabel }, fallbackLabel),
            ),
        ),
        e(PathAnalysisState, { data: props.data, compact: true }),
        ...outputPorts.map((port, index) => e(Handle, {
            key: port.id,
            type: 'source',
            id: port.id,
            position: Position.Bottom,
            className: port.kind === 'fallback'
                ? 'bg-muted-foreground border-2 border-background'
                : 'bg-cyan-500 border-2 border-background',
            style: {
                width: 10,
                height: 10,
                bottom: 0,
                left: `${((index + 1) / (outputPorts.length + 1)) * 100}%`,
                transform: 'translate(-50%, 50%)',
            },
        })),
        props.selected
            ? e('button', {
                onClick: handleDelete,
                className: 'absolute -top-5 right-1 p-1 bg-destructive text-destructive-foreground rounded-full shadow-lg hover:scale-110 transition-transform',
            }, e(IconTrash, { size: 12 }))
            : null,
    );
};

const RegistryBuilderNode = (props: NodeProps<any>) => {
    if (props.type === 'start') return e(StartRegistryNode, props);
    if (props.type === 'end') return e(EndRegistryNode, props);
    if (props.type === 'branch') return e(BranchRegistryNode, props);
    if (props.type === 'validation') return e(ValidationRegistryNode, props);
    if (props.type === 'merge') return e(MergeRegistryNode, props);
    if (props.type === 'branchOut') return e(BranchOutRegistryNode, props);
    return e(CommonRegistryNode, props);
};

const componentMap: Record<string, React.ComponentType<any>> = Object.fromEntries(
    Object.keys(builderRegistry).map((type) => [type, RegistryBuilderNode]),
);

export const nodeTypes: NodeTypes = componentMap;

import AnalysisEdge from '../edges/AnalysisEdge';
import DeleteableEdge from '../edges/DeleteableEdge';
import JumpEdge from '../edges/JumpEdge';
import VisibilityEdge from '../edges/VisibilityEdge';
export const edgeTypes = {
    analysis: AnalysisEdge,
    default: DeleteableEdge,
    jump: JumpEdge,
    visibility: VisibilityEdge,
};

export * from './definitions';
