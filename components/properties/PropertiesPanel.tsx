import React from "react";
import { useReactFlow, Node, Edge } from "@xyflow/react";
import apiClient from "@/lib/api-client";
import { getNodeDefinition, PropertyField } from "@/components/nodes/definitions";
import { builderRegistry, type NodeBuilder } from "@surveystudio/node-registery/builder";
import { IconX, IconFolderPlus, IconTrash, IconPlus, IconPhoto } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ConditionBuilder } from "./ConditionBuilder";
import { StepsBuilder } from "./StepsBuilder";
import EmojiPicker from "./EmojiPicker";
import { MediaPreview } from "../nodes/MediaPreview";
import type { WorkflowValidationIssue } from "@/api/surveyWorkflow";

// ... (imports remain same)

interface PropertiesPanelProps {
    node: Node | null;
    nodes: Node[]; // Full list of nodes needed for logic builder
    issues?: WorkflowValidationIssue[];
    onChange: (fieldName: string, value: any) => void;
    onClose: () => void;
    readOnly?: boolean;
}

export default function PropertiesPanel({ node, nodes, issues = [], onChange, onClose, readOnly = false }: PropertiesPanelProps) {
    const { getEdges } = useReactFlow();
    const edges = getEdges();

    // Get the definition for this node type
    const definition = node ? getNodeDefinition(node.type || "") : null;
    const registryBuilder = node
        ? builderRegistry[node.type as keyof typeof builderRegistry] as unknown as NodeBuilder | undefined
        : undefined;
    const RegistrySettingsComponent = registryBuilder?.SettingsComponent as React.ComponentType<any> | undefined;

    const handleRegistrySettingsChange = (nextData: Record<string, unknown>) => {
        if (readOnly || !node) return;
        const currentData = (node.data || {}) as Record<string, unknown>;
        Object.entries(nextData).forEach(([fieldName, value]) => {
            if (currentData[fieldName] !== value) onChange(fieldName, value);
        });
    };

    const conditionField = definition?.properties.find((property) => property.name === "condition");

    if (!node || !definition) {
        return null;
    }


    return (
        <aside className="w-xs h-full bg-background border-l border-border flex flex-col shadow-xl z-20 transition-all duration-300">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-border bg-muted/10 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        <definition.icon size={16} />
                    </div>
                    <span className="font-semibold text-sm tracking-tight">{definition.label}</span>
                    {readOnly && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md border border-border text-muted-foreground">Read Only</span>}
                </div>
                <button title="X Icon" onClick={onClose} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
                    <IconX size={16} />
                </button>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {issues.length > 0 && (
                    <div className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                        <p className="text-[11px] font-semibold mb-2">Validation</p>
                        <div className="space-y-1.5">
                            {issues.map((issue, idx) => (
                                <div
                                    key={`${issue.code}-${idx}`}
                                    className={cn(
                                        "rounded px-2 py-1 text-[11px] border",
                                        issue.type === "error"
                                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                                            : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                                    )}
                                >
                                    <span className="font-semibold mr-1">{issue.type === "error" ? "Error:" : "Warning:"}</span>
                                    {issue.message}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {RegistrySettingsComponent && (
                    <div className={cn(readOnly && "pointer-events-none opacity-60 grayscale")}>
                        <RegistrySettingsComponent
                            data={(node.data || {}) as any}
                            readOnly={readOnly}
                            onChange={(nextData: Record<string, unknown>) => handleRegistrySettingsChange(nextData)}
                            renderField={({ property, value, onChange: onFieldChange }: any) => (
                                <FieldRenderer
                                    field={property as PropertyField}
                                    value={value}
                                    onChange={(val) => {
                                        if (readOnly) return;
                                        if (property.name === 'bulkOptions') {
                                            const lines = String(val).split('\n').map(l => l.trim()).filter(l => l.length > 0);
                                            if (lines.length > 0) {
                                                const newOptions = lines.map((l, i) => ({ label: l, value: `opt${Date.now()}_${i}` }));
                                                const optionsField = definition.properties.find(p => p.type === 'options');
                                                if (optionsField) onChange(optionsField.name, newOptions);
                                            }
                                        }
                                        onFieldChange(val);
                                    }}
                                    nodes={nodes}
                                    edges={edges}
                                    readOnly={readOnly}
                                    nodeType={node.type}
                                    nodeId={node.id}
                                />
                            )}
                        />
                    </div>
                )}

                {/* Debug Info */}
                <div className="mt-8 p-3 rounded-md bg-muted/50 border border-border text-[10px] font-mono text-muted-foreground break-all">
                    ID: {node.id} <br />
                    Type: {node.type}
                </div>
            </div>
        </aside>
    );
}


function FieldRenderer({
    field,
    value,
    onChange,
    nodes,
    edges,
    readOnly,
    nodeType,
    nodeId
}: {
    field: PropertyField,
    value: any,
    onChange: (val: any) => void,
    nodes: Node[],
    edges: Edge[],
    readOnly?: boolean,
    nodeType?: string,
    nodeId?: string
}) {
    if (readOnly) {
        // Logic fields and complex builders should be disabled
        if (['condition', 'stepBuilder', 'emojiOptions'].includes(field.type)) {
            return (
                <div className="pointer-events-none opacity-60 grayscale">
                    <FieldRenderer field={field} value={value} onChange={() => { }} nodes={nodes} edges={edges} readOnly={false} nodeType={nodeType} nodeId={nodeId} />
                </div>
            );
        }
    }

    switch (field.type) {
        case 'condition':
            return (
                <ConditionBuilder
                    value={value || { field: '', operator: 'equals', value: '' }}
                    onChange={onChange}
                    nodes={nodes}
                    edges={edges}
                    currentNodeId={nodeId}
                    builderMode={nodeType === 'validation' ? 'validation' : 'default'}
                />
            );
        case 'stepBuilder':
            return (
                <StepsBuilder
                    value={value || []}
                    onChange={onChange}
                />
            );
        case 'text':
            return (
                <input
                    type="text"
                    disabled={readOnly}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
            );
        case 'textarea':
            return (
                <textarea
                    disabled={readOnly}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                />
            );
        case 'fileTextarea':
            const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const text = event.target?.result as string;
                    if (text) {
                        const tokens = text.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);
                        if (tokens.length > 0) {
                            const unique = Array.from(new Set(tokens)).join(', ');
                            onChange(unique);
                        }
                    }
                };
                reader.readAsText(file);
            };

            return (
                <div className="space-y-1">
                    <textarea
                        disabled={readOnly}
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {!readOnly && (
                        <div className="flex justify-end">
                            <label className="text-xs flex items-center gap-1 cursor-pointer text-primary hover:underline bg-primary/5 px-2 py-1 rounded-md transition-colors">
                                <IconFolderPlus size={12} />
                                <span>Import from .txt</span>
                                <input type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}
                </div>
            );
        case 'file':
            const handleS3Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file) return;

                try {
                    const res = await apiClient.post('/storage/upload-url', {
                        filename: file.name,
                        fileType: file.type
                    });

                    const { uploadUrl, key } = res.data;
                    const upload = await fetch(uploadUrl, {
                        method: 'PUT',
                        body: file,
                        headers: { 'Content-Type': file.type }
                    });
                    if (!upload.ok) throw new Error("Failed to upload file to S3");
                    // Save ONLY the storage key, not the public URL
                    onChange(key);
                } catch (err) {
                    console.error("Upload failed", err);
                    alert("Upload failed. Check console for details.");
                }
            };

            return (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            disabled={readOnly}
                            value={value || ""}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={field.placeholder || "Storage key..."}
                            className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>
                    {!readOnly && (
                        <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                            <IconFolderPlus size={20} className="text-muted-foreground" />
                            <span className="text-sm text-muted-foreground font-medium">Click to Upload File</span>
                            <input type="file" className="hidden" onChange={handleS3Upload} />
                        </label>
                    )}
                </div>
            );
        case 'files':
            const handleMultiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                const uploadedKeys = [...(value || [])];

                // 1. Get Presigned URLs and upload each
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    try {
                        const res = await apiClient.post('/storage/upload-url', {
                            filename: file.name,
                            fileType: file.type
                        });

                        const { uploadUrl, key } = res.data;

                        await fetch(uploadUrl, {
                            method: 'PUT',
                            body: file,
                            headers: { 'Content-Type': file.type }
                        });

                        uploadedKeys.push(key);
                    } catch (err) {
                        console.error("Upload failed for file:", file.name, err);
                    }
                }
                onChange(uploadedKeys);
            };

            return (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        {(value || []).map((storageKey: string, idx: number) => (
                            <div key={idx} className="relative group aspect-square rounded-md overflow-hidden border border-border bg-muted">
                                <MediaPreview storageKey={storageKey} type="image" className="w-full h-full" />
                                {!readOnly && (
                                    <button
                                        title="Trash Icon"
                                        onClick={() => {
                                            const newFiles = value.filter((_: any, i: number) => i !== idx);
                                            onChange(newFiles);
                                        }}
                                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    >
                                        <IconTrash size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {!readOnly && (
                            <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border rounded-md cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary">
                                <IconPlus size={24} />
                                <span className="text-[10px] font-medium mt-1">Add Image</span>
                                <input type="file" multiple className="hidden" onChange={handleMultiUpload} accept="image/*" />
                            </label>
                        )}
                    </div>
                </div>
            );
        case 'number':
            return (
                <input
                    title="Number Input"
                    type="number"
                    disabled={readOnly}
                    value={value || ""}
                    onChange={(e) => onChange(Number(e.target.value))}
                    min={field.min}
                    max={field.max}
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
            );
        case 'switch':
            return (
                <div className="flex items-center gap-2">
                    <button
                        title="Enabled/Disabled Button"
                        disabled={readOnly}
                        onClick={() => onChange(!value)}
                        className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
                            value ? "bg-primary" : "bg-input"
                        )}
                    >
                        <span
                            className={cn(
                                "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                                value ? "translate-x-5" : "translate-x-1"
                            )}
                        />
                    </button>
                    <span className="text-sm text-foreground">{value ? "Enabled" : "Disabled"}</span>
                </div>
            );
        case 'options':
            const optionValues = Array.isArray(value) ? value : [];
            const isScaleItemsField = (nodeType === 'rating' || nodeType === 'slider') && field.name === 'items';
            const handleOptionImageUpload = async (index: number) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;

                    try {
                        const res = await apiClient.post('/storage/upload-url', {
                            filename: file.name,
                            fileType: file.type
                        });
                        const { uploadUrl, key } = res.data;

                        const upload = await fetch(uploadUrl, {
                            method: 'PUT',
                            body: file,
                            headers: { 'Content-Type': file.type }
                        });

                        if (!upload.ok) throw new Error("Failed to upload image");

                        const newOptions = [...optionValues];
                        newOptions[index] = { ...newOptions[index], imageUrl: key };
                        onChange(newOptions);
                    } catch (err) {
                        console.error("Upload failed", err);
                        alert("Upload failed. Please try again.");
                    }
                };
                input.click();
            };

            return (
                <div className="space-y-2">
                    {optionValues.map((option: any, index: number) => (
                        <div key={index} className="flex flex-col gap-1.5 p-2 rounded-lg border border-border bg-muted/5 group">
                            <div className="flex gap-1 items-center">
                                <input
                                    type="text"
                                    disabled={readOnly}
                                    value={option.label}
                                    onChange={(e) => {
                                        const newOptions = [...optionValues];
                                        newOptions[index] = { ...newOptions[index], label: e.target.value };
                                        onChange(newOptions);
                                    }}
                                    className="flex-1 px-3 py-1.5 text-sm bg-background border border-input rounded-md focus:ring-1 focus:ring-primary outline-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder={isScaleItemsField ? `Item ${index + 1}` : `Option ${index + 1}`}
                                />
                                {!readOnly && (
                                    <div className="flex items-center shrink-0">
                                        <button
                                            onClick={() => handleOptionImageUpload(index)}
                                            className={cn(
                                                "p-2 transition-colors rounded-md hover:bg-muted",
                                                option.imageUrl ? "text-primary" : "text-muted-foreground hover:text-primary"
                                            )}
                                            title={option.imageUrl ? "Change Image" : "Add Image"}
                                        >
                                            <IconPhoto size={16} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const newOptions = optionValues.filter((_: any, i: number) => i !== index);
                                                onChange(newOptions);
                                            }}
                                            className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-muted"
                                            title="Delete Option"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {option.imageUrl && (
                                <div className="relative group/preview mx-1 mb-1">
                                    <MediaPreview
                                        storageKey={option.imageUrl}
                                        type="image"
                                        className="w-full h-24 rounded-md object-cover border border-border bg-white"
                                    />
                                    {!readOnly && (
                                        <button
                                            onClick={() => {
                                                const newOptions = [...optionValues];
                                                const updatedOption = { ...newOptions[index] };
                                                delete updatedOption.imageUrl;
                                                newOptions[index] = updatedOption;
                                                onChange(newOptions);
                                            }}
                                            className="absolute top-1 right-1 p-1.5 bg-destructive/90 text-white rounded-full opacity-0 group-hover/preview:opacity-100 transition-opacity shadow-sm hover:bg-destructive"
                                            title="Remove Image"
                                        >
                                            <IconTrash size={12} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {!readOnly && (
                        (optionValues.length > 0) ? (
                            <button
                                onClick={() => onChange([
                                    ...optionValues,
                                    {
                                        label: isScaleItemsField ? `Item ${optionValues.length + 1}` : `Option ${optionValues.length + 1}`,
                                        value: isScaleItemsField ? `item${Date.now()}` : `opt${Date.now()}`
                                    }
                                ])}
                                className="text-xs text-primary hover:underline font-medium py-1 px-2"
                            >
                                {isScaleItemsField ? '+ Add Item' : '+ Add Option'}
                            </button>
                        ) : (
                            isScaleItemsField ? (
                                <button
                                    onClick={() => onChange([
                                        { label: 'Overall Rating', value: `item${Date.now()}_overall` },
                                        { label: 'Item 2', value: `item${Date.now()}_2` }
                                    ])}
                                    className="w-full flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-lg hover:bg-muted/50 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary group"
                                >
                                    <div className="p-2 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors">
                                        <IconPlus size={20} className="text-primary" />
                                    </div>
                                    <span className="text-sm font-medium">Add Another Rating Item</span>
                                    <p className="text-[10px] opacity-70">Default rating uses the Field Label automatically</p>
                                </button>
                            ) : (
                                <button
                                    onClick={() => onChange([{ label: 'Option 1', value: `opt${Date.now()}` }])}
                                    className="w-full flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-lg hover:bg-muted/50 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary group"
                                >
                                    <div className="p-2 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors">
                                        <IconPlus size={20} className="text-primary" />
                                    </div>
                                    <span className="text-sm font-medium">Add Your First Option</span>
                                    <p className="text-[10px] opacity-70">Click to start building your list</p>
                                </button>
                            )
                        )
                    )}
                </div>
            );
        case 'select':
            return (
                <div className="relative">
                    <select
                        title="Select Dropdown"
                        disabled={readOnly}
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    {/* Chevron icon for better UI */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>
            );
        case 'emojiOptions':
            return (
                <EmojiPicker
                    value={value || []}
                    onChange={onChange}
                />
            );
        default:
            return <div className="text-xs text-destructive">Unsupported field type: {field.type}</div>;
    }
}
