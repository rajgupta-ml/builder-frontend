import React from "react";
import { useReactFlow, Node } from "@xyflow/react";
import apiClient from "@/lib/api-client";
import { getNodeDefinition, PropertyField } from "@/components/nodes/definitions";
import { IconX, IconFolderPlus, IconTrash, IconPlus, IconPhoto } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ConditionBuilder } from "./ConditionBuilder";
import { StepsBuilder } from "./StepsBuilder";
import EmojiPicker from "./EmojiPicker";
import { MediaPreview } from "../nodes/MediaPreview";

// ... (imports remain same)

interface PropertiesPanelProps {
    node: Node | null;
    nodes: Node[]; // Full list of nodes needed for logic builder
    onChange: (fieldName: string, value: any) => void;
    onClose: () => void;
    readOnly?: boolean;
}

export default function PropertiesPanel({ node, nodes, onChange, onClose, readOnly = false }: PropertiesPanelProps) {

    // Get the definition for this node type
    const definition = node ? getNodeDefinition(node.type || "") : null;

    if (!node || !definition) {
        return null;
    }


    return (
        <aside className="w-[320px] h-full bg-background border-l border-border flex flex-col shadow-xl z-20 transition-all duration-300">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-border bg-muted/10 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        <definition.icon size={16} />
                    </div>
                    <span className="font-semibold text-sm tracking-tight">{definition.label}</span>
                    {readOnly && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md border border-border text-muted-foreground">Read Only</span>}
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
                    <IconX size={16} />
                </button>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {(() => {
                    // Pre-calculate data with defaults for consistent visibility checks
                    const dataWithDefaults = { ...node.data };
                    definition.properties.forEach(p => {
                        if (dataWithDefaults[p.name] === undefined && p.defaultValue !== undefined) {
                            dataWithDefaults[p.name] = p.defaultValue;
                        }
                    });

                    // Group properties by category
                    const basicFields = ['label', 'description', 'questionLabel', 'url', 'urls'];
                    const optionFields = ['options', 'bulkOptions', 'items', 'columns', 'rows', 'steps'];
                    const choiceFields = ['allowOther', 'otherLabel', 'allowNone', 'noneLabel', 'randomizeOptions', 'maxChoices'];
                    const advancedFields = ['placeholder', 'searchable', 'displayMode', 'min', 'max', 'step', 'defaultValue', 'checkboxLabel', 'minChars', 'maxChars', 'minWords', 'maxWords'];
                    const logicFields = ['condition'];

                    const groupedProperties = {
                        basic: definition.properties.filter(p => basicFields.includes(p.name)),
                        options: definition.properties.filter(p => optionFields.includes(p.name)),
                        choice: definition.properties.filter(p => choiceFields.includes(p.name)),
                        advanced: definition.properties.filter(p => advancedFields.includes(p.name)),
                        logic: definition.properties.filter(p => logicFields.includes(p.name)),
                        other: definition.properties.filter(p =>
                            !basicFields.includes(p.name) &&
                            !optionFields.includes(p.name) &&
                            !choiceFields.includes(p.name) &&
                            !advancedFields.includes(p.name) &&
                            !logicFields.includes(p.name)
                        )
                    };

                    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
                        'Basic Settings': true,
                        'Options': false,
                        'Choice Settings': false,
                        'Advanced': false,
                        'Logic': false,
                        'Other': false
                    });

                    const toggleSection = (title: string) => {
                        setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }));
                    };

                    const renderSection = (title: string, fields: PropertyField[]) => {
                        const visibleFields = fields.filter(field =>
                            !field.visible || field.visible(dataWithDefaults) !== false
                        );

                        if (visibleFields.length === 0) return null;

                        const isExpanded = expandedSections[title];

                        return (
                            <div key={title} className="border border-border rounded-lg overflow-hidden bg-card">
                                <button
                                    onClick={() => toggleSection(title)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
                                >
                                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                                        {title}
                                    </h3>
                                    <svg
                                        className={cn("w-4 h-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isExpanded && (
                                    <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border bg-background">
                                        {visibleFields.map((field) => (
                                            <div key={field.name} className="space-y-1.5">
                                                <label className="text-xs font-medium text-foreground">
                                                    {field.label}
                                                </label>

                                                <FieldRenderer
                                                    field={field}
                                                    value={node.data[field.name] ?? field.defaultValue}
                                                    onChange={(val) => {
                                                        if (readOnly) return;
                                                        if (field.name === 'bulkOptions') {
                                                            const lines = String(val).split('\n').map(l => l.trim()).filter(l => l.length > 0);
                                                            if (lines.length > 0) {
                                                                const newOptions = lines.map((l, i) => ({ label: l, value: `opt${Date.now()}_${i}` }));
                                                                onChange('options', newOptions);
                                                            }
                                                        }
                                                        onChange(field.name, val);
                                                    }}
                                                    nodes={nodes}
                                                    readOnly={readOnly}
                                                />

                                                {field.helperText && (
                                                    <p className="text-[10px] text-muted-foreground italic">{field.helperText}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    };

                    return (
                        <>
                            {renderSection('Basic Settings', groupedProperties.basic)}
                            {renderSection('Options', groupedProperties.options)}
                            {renderSection('Choice Settings', groupedProperties.choice)}
                            {renderSection('Advanced', groupedProperties.advanced)}
                            {renderSection('Logic', groupedProperties.logic)}
                            {renderSection('Other', groupedProperties.other)}
                        </>
                    );
                })()}

                {/* Debug Info */}
                <div className="mt-8 p-3 rounded-md bg-muted/50 border border-border text-[10px] font-mono text-muted-foreground break-all">
                    ID: {node.id} <br />
                    Type: {node.type}
                </div>
            </div>
        </aside>
    );
}


function FieldRenderer({ field, value, onChange, nodes, readOnly }: { field: PropertyField, value: any, onChange: (val: any) => void, nodes: Node[], readOnly?: boolean }) {
    if (readOnly) {
        // Logic fields and complex builders should be disabled
        if (['condition', 'stepBuilder', 'emojiOptions'].includes(field.type)) {
            return (
                <div className="pointer-events-none opacity-60 grayscale">
                    <FieldRenderer field={field} value={value} onChange={() => { }} nodes={nodes} readOnly={false} />
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
            return (
                <div className="space-y-2">
                    {(value || []).map((option: any, index: number) => (
                        <div key={index} className="flex flex-col gap-2 p-2 border rounded-md bg-muted/5">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    disabled={readOnly}
                                    value={option.label}
                                    onChange={(e) => {
                                        const newOptions = [...value];
                                        newOptions[index] = { ...newOptions[index], label: e.target.value };
                                        onChange(newOptions);
                                    }}
                                    className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder={`Option ${index + 1}`}
                                />
                                {!readOnly && (
                                    <button
                                        onClick={() => {
                                            const newOptions = value.filter((_: any, i: number) => i !== index);
                                            onChange(newOptions);
                                        }}
                                        className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                    >
                                        <IconTrash size={14} />
                                    </button>
                                )}
                            </div>

                            {!readOnly && (
                                <div className="flex flex-col gap-2 p-2 border border-dashed rounded-md bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
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

                                                        const newOptions = [...value];
                                                        newOptions[index] = { ...newOptions[index], imageUrl: key };
                                                        onChange(newOptions);
                                                    } catch (err) {
                                                        console.error("Upload failed", err);
                                                        alert("Upload failed. Please try again.");
                                                    }
                                                };
                                                input.click();
                                            }}
                                            className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                                        >
                                            <IconPhoto size={12} />
                                            {option.imageUrl ? "Change Image" : "Add Image"}
                                        </button>
                                        {option.imageUrl && (
                                            <button
                                                onClick={() => {
                                                    const newOptions = [...value];
                                                    const updatedOption = { ...newOptions[index] };
                                                    delete updatedOption.imageUrl;
                                                    newOptions[index] = updatedOption;
                                                    onChange(newOptions);
                                                }}
                                                className="text-[10px] text-muted-foreground hover:text-destructive"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    {option.imageUrl && (
                                        <MediaPreview
                                            storageKey={option.imageUrl}
                                            type="image"
                                            className="w-full h-20 rounded-sm"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {!readOnly && (
                        <button
                            onClick={() => onChange([...(value || []), { label: `Option ${(value?.length || 0) + 1}`, value: `opt${Date.now()}` }])}
                            className="text-xs text-primary hover:underline"
                        >
                            + Add Option
                        </button>
                    )}
                </div>
            );
        case 'select':
            return (
                <div className="relative">
                    <select
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
