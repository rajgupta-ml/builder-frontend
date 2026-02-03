import z from "zod";

export const createSurveySchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters long"),
    description: z.string().min(3, "Description must be at least 3 characters long"),
    client : z.string().min(3, "Client name must be at least 3 characters long"),
})

export const updateSurveySchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters long").optional(),
    description: z.string().min(3, "Description must be at least 3 characters long").optional(),
    redirectUrl: z.string().nullable().optional(),
    overQuotaUrl: z.string().nullable().optional(),
    securityTerminateUrl: z.string().nullable().optional(),
    globalQuota: z.number().nullable().optional(),
})

export type CreateSurveyData = z.infer<typeof createSurveySchema>;
export type UpdateSurveyData = z.infer<typeof updateSurveySchema>;