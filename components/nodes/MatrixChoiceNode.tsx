import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconGridDots } from '@tabler/icons-react';

const MatrixChoiceNode = (props: NodeProps<any>) => {
    const { label, description, required, rows, columns, multiple } = props.data;

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconGridDots}
            color="bg-purple-500"
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1">
                        {label || "Grid Question"}
                        {required && <span className="text-destructive">*</span>}
                    </label>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>

                {/* Matrix Visualization */}
                <div className="border border-border rounded-md overflow-hidden text-[10px]">
                    {/* Header Row */}
                    <div className="flex bg-muted/30 border-b border-border">
                        <div className="w-1/3 p-2 border-r border-border bg-muted/10"></div>
                        {(columns as any[] || []).map((col: any, i: number) => (
                            <div key={i} className="flex-1 p-1 flex items-center justify-center text-center font-medium text-muted-foreground bg-muted/10 border-l border-border/50">
                                {col.label || i + 1}
                            </div>
                        ))}
                    </div>

                    {/* Rows */}
                    {(rows as any[] || []).map((row: any, i: number) => (
                        <div key={i} className="flex border-b border-border/50 last:border-0">
                            <div className="w-1/3 p-2 font-medium border-r border-border truncate bg-muted/5 flex items-center">
                                {row.label || `Row ${i + 1}`}
                            </div>
                            {(columns as any[] || []).map((col: any, j: number) => (
                                <div key={j} className="flex-1 p-1 flex items-center justify-center border-l border-border/50">
                                    <div className={`w-3 h-3 border border-muted-foreground/40 ${multiple ? 'rounded-xs' : 'rounded-full'}`} />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(MatrixChoiceNode);
