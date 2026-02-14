import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode, { BaseNodeData } from './BaseNode';
import { IconShieldLock, IconShieldCheck } from '@tabler/icons-react';

interface CaptchaData extends BaseNodeData {
    sitekey?: string;
    description?: string;
}

const CaptchaNode = (props: NodeProps<any>) => {
    const { label, description } = props.data;

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconShieldLock}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                        {label || "Security Verification"}
                    </label>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/30 border border-dashed border-border rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <IconShieldCheck size={24} />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-semibold text-foreground">Cloudflare Turnstile</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                            Protected by Cloudflare
                        </p>
                    </div>
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(CaptchaNode);
