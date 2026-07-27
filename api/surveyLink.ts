import apiClient from "@/lib/api-client";

export interface SurveyGleLink {
    id: string;
    orgId: string;
    gleProjectId: string;
    surveyStudioId: string;
    createdBy: string;
    createdAt: string;
}

export interface AvailableGleProject {
    id: number;
    publicId: string;
    name: string;
    status: string;
    clientName?: string;
    notes?: string;
}

export const surveyLinkApi = {
    getSurveyLink: async (surveyId: string): Promise<SurveyGleLink | null> => {
        const { data } = await apiClient.get<{ data: SurveyGleLink | null }>(`/surveys/${surveyId}/link`);
        return data.data;
    },

    unlinkSurvey: async (surveyId: string): Promise<void> => {
        await apiClient.delete(`/surveys/${surveyId}/link`);
    },

    getAvailableGleProjects: async (): Promise<AvailableGleProject[]> => {
        const { data } = await apiClient.get<{ data: AvailableGleProject[] }>('/surveys/available-gle-projects');
        return data.data ?? [];
    },

    linkSurveyToGle: async (surveyId: string, gleProjectId: string): Promise<SurveyGleLink> => {
        const { data } = await apiClient.post<{ data: SurveyGleLink }>(`/surveys/${surveyId}/link`, { gleProjectId });
        return data.data;
    },
};
