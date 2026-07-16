import { createElement } from 'react';
import type React from 'react';
import { Handle, Position, useReactFlow, type NodeProps, type NodeTypes } from '@xyflow/react';
import {
    IconArrowMerge,
    IconCalendar,
    IconCheckbox,
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
    IconStar,
    IconTextCaption,
    IconTrash,
    IconMapPin,
    IconCheck,
    IconX,
} from '@tabler/icons-react';
import { builderRegistry } from '@surveystudio/node-registery/builder';
import type { NodeBuilder } from '@surveystudio/node-registery/builder';
import BaseNode from './BaseNode';
import { cn } from '@/lib/utils';
import { NODE_DEFINITIONS } from './definitions';

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

const renderCanvas = (props: NodeProps<any>) => {
    const entry = getBuilder(String(props.type || ''));
    const CanvasComponent = entry?.CanvasComponent;

    if (!CanvasComponent) {
        return e('div', { className: 'text-xs text-muted-foreground italic' }, 'No preview available');
    }

    return e(CanvasComponent as React.ComponentType<any>, {
        id: props.id,
        type: String(props.type || ''),
        data: props.data,
        selected: props.selected,
    });
};

const SkipRulesBadge = (props: NodeProps<any>) => {
    const skips = Array.isArray((props.data as any)?.skips)
        ? ((props.data as any).skips as any[]).filter((rule) => rule && typeof rule === 'object')
        : [];
    if (skips.length === 0) return null;

    return e(
        'div',
        {
            className: 'mt-2 inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-600',
            title: skips.map((rule, index) => String(rule?.label || `Skip rule ${index + 1}`)).join('\n'),
        },
        e(IconGitBranch, { size: 10 }),
        skips.length === 1 ? 'Skip logic' : `Skip logic · ${skips.length}`,
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
        e(SkipRulesBadge, props),
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
        e(Handle, {
            type: 'target',
            position: Position.Top,
            className: 'bg-red-700 border-2 border-white',
            style: { width: 10, height: 10 },
        }),
        e(IconForbid, { size: 16 }),
        renderCanvas(props),
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

import DeleteableEdge from '../edges/DeleteableEdge';
import JumpEdge from '../edges/JumpEdge';
export const edgeTypes = {
    default: DeleteableEdge,
    jump: JumpEdge,
};

export * from './definitions';
