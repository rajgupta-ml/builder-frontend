import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode, { BaseNodeData } from './BaseNode';
import { IconShieldLock, IconShieldCheck } from '@tabler/icons-react';
import { CaptchaNode as CaptchaPrimitive } from '@surveystudio/node-registery/ui';

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
            <CaptchaPrimitive.Root className="space-y-4">
                <CaptchaPrimitive.Header className="space-y-1">
                    <CaptchaPrimitive.Label className="text-sm font-medium text-foreground">
                        {label || "Security Verification"}
                    </CaptchaPrimitive.Label>
                    {description && (
                        <CaptchaPrimitive.Description className="text-xs text-muted-foreground">{description}</CaptchaPrimitive.Description>
                    )}
                </CaptchaPrimitive.Header>

                <CaptchaPrimitive.Panel className="flex items-center gap-3 p-3 bg-muted/30 border border-dashed border-border rounded-xl">
                    <CaptchaPrimitive.Item className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <IconShieldCheck size={24} />
                    </CaptchaPrimitive.Item>
                    <CaptchaPrimitive.Item className="flex-1">
                        <CaptchaPrimitive.Text className="text-xs font-semibold text-foreground">Cloudflare Turnstile</CaptchaPrimitive.Text>
                        <CaptchaPrimitive.Description className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                            Protected by Cloudflare
                        </CaptchaPrimitive.Description>
                    </CaptchaPrimitive.Item>
                </CaptchaPrimitive.Panel>
            </CaptchaPrimitive.Root>
        </BaseNode>
    );
};

export default memo(CaptchaNode);
