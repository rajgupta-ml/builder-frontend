import z from "zod";

const logicRuleSchema = z.object({
    id: z.string(),
    type: z.literal('rule'),
    field: z.string(),
    subField: z.string().optional(),
    operator: z.string(),
    value: z.any(),
    valueType: z.enum(['static', 'variable']),
});

// Lazy validation for recursive group
const logicGroupSchema: z.ZodType<any> = z.lazy(() => z.object({
    id: z.string(),
    type: z.literal('group'),
    logicType: z.enum(['AND', 'OR']),
    children: z.array(z.union([logicGroupSchema, logicRuleSchema])),
}));

const logicItemSchema = z.union([logicGroupSchema, logicRuleSchema]);

// Node Data Schema
const nodeDataSchema = z.record(z.string(), z.any()).and(z.object({
    label: z.string().optional(),
    condition: logicGroupSchema.optional(), // Logic usually sits on the edge or specifically on BranchNode, but preserving structure
}));

// Node Schema
const nodeSchema = z.object({
    id: z.string(),
    type: z.string().optional(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: nodeDataSchema,
    // Add other fields as necessary from React Flow
});

// Edge Schema
const edgeSchema = z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
    type: z.string().optional(),
});

// Design JSON Schema (React Flow structure)
const designJsonSchema = z.object({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
    viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
});

// Runtime JSON Schema (Consumable by Survey Runner)
const runtimeNextSchema = z.discriminatedUnion('kind', [
    z.object({ 
        kind: z.literal('linear'), 
        nextId: z.string().nullable() 
    }),
    z.object({ 
        kind: z.literal('branch'), 
        trueId: z.string().nullable(), 
        falseId: z.string().nullable() 
    })
]);

const runtimeNodeSchema = z.object({
    id: z.string(), // Canonical ID
    type: z.string(),
    data: z.any(),
    next: runtimeNextSchema
});

const runtimeJsonSchema = z.record(z.string(), runtimeNodeSchema);

export const createSurveyWorkflowSchema = z.object({
    surveyId: z.string().uuid("Invalid Survey ID"),
    designJson: designJsonSchema,
    runtimeJson: runtimeJsonSchema, 
});

export const updateSurveyWorkflowSchema = z.object({
    designJson: designJsonSchema.optional(),
    runtimeJson: runtimeJsonSchema.optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export type CreateSurveyWorkflowData = z.infer<typeof createSurveyWorkflowSchema>;
export type UpdateSurveyWorkflowData = z.infer<typeof updateSurveyWorkflowSchema>;
