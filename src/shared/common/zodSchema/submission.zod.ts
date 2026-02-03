import z from "zod";

export const surveySubmissionSchema = z.object({
    surveyId: z.string().uuid("Invalid Survey ID"),
    mode: z.enum(['LIVE', 'TEST']).default('TEST'),
    response: z.record(z.string(), z.any()), // JSON object of answers
    status: z.enum([
        'COMPLETED', 
        'DROPPED', 
        'DISQUALIFIED', 
        'OVER_QUOTA', 
        'IN_PROGRESS', 
        'CLICKED', 
        'QUALITY_TERMINATE', 
        'SECURITY_TERMINATE'
    ]).default('IN_PROGRESS'),
    outcome: z.string().optional().nullable(),
    respondentId: z.string().optional().nullable(),
});

export type SurveySubmissionData = z.infer<typeof surveySubmissionSchema>;
