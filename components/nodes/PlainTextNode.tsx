import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { builderRegistry } from '@surveystudio/node-registery/builder';
import BaseNode from './BaseNode';
import { IconTextCaption } from '@tabler/icons-react';

const PlainTextPreview = builderRegistry.plainText.CanvasComponent;

const PlainTextNode = (props: NodeProps<any>) => {
    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconTextCaption}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            {PlainTextPreview ? (
                <PlainTextPreview
                    id={props.id}
                    type="plainText"
                    data={props.data}
                    selected={props.selected}
                />
            ) : null}
        </BaseNode>
    );
};

export default memo(PlainTextNode);
