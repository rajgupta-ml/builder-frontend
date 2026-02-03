import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode, { BaseNodeData } from './BaseNode';
import { IconTextCaption } from '@tabler/icons-react';

interface TextInputData extends BaseNodeData {
    placeholder?: string;
    value?: string;
    // BaseNodeData enforces 'label: string', so we must either make it optional here or ensure it's always passed.
    // However, BaseNodeData actually says 'label: string', so we don't need to redeclare it as optional unless we want to override.
    // The previous error was because I redeclared it as optional 'label?: string' which conflicts.
    // I will just remove the redeclaration to inherit from BaseNodeData.
    description?: string;
    required?: boolean;
    longAnswer?: boolean;
}

const TextInputNode = (props: NodeProps<any>) => {
    const { label, placeholder, description, required, longAnswer } = props.data;

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconTextCaption}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                        {label || "Text Question"}
                    </label>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>

                {longAnswer ? (
                    <div className="w-full bg-transparent border border-border rounded-md p-2 text-sm font-medium min-h-[60px] text-muted-foreground/50">
                        {placeholder || "Long textual answer..."}
                    </div>
                ) : (
                    <input
                        type="text"
                        readOnly
                        className="w-full bg-transparent border-b border-border py-1 text-sm font-medium focus:outline-hidden focus:border-primary transition-colors placeholder:text-muted-foreground/50 cursor-default"
                        placeholder={placeholder || "Short answer..."}
                    />
                )}
            </div>
        </BaseNode>
    );
};

export default memo(TextInputNode);
