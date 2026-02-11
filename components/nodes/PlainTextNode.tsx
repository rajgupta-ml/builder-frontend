import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconTextCaption } from '@tabler/icons-react';

const PlainTextNode = (props: NodeProps<any>) => {
    const { label, description, buttonLabel } = props.data;

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
                        {label || "Info Screen"}
                    </label>
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md whitespace-pre-wrap max-h-24 overflow-hidden text-ellipsis">
                        {description || "No content provided..."}
                    </div>
                </div>
                <div className="flex justify-end">
                    <button className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded" disabled>
                        {buttonLabel || "Continue"}
                    </button>
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(PlainTextNode);
