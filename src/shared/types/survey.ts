import type { LogicGroup, LogicRule } from "@/components/properties/conditionTypes";
export type { LogicGroup, LogicRule };

export interface Surveys {
  id: string;
  name: string;
  status: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  client : string;
}
export interface Survey {
  id: string;
  name: string;
  status: string;
  globalQuota: number | null;
  overQuotaUrl: string | null;
  client: string; 
  redirectUrl: string | null;
  securityTerminateUrl: string | null;
  privacyConfig?: {
    privacyMode?: "standard" | "strict";
    responseRetentionDays?: number;
    collectGeo?: boolean;
    collectUserAgent?: boolean;
    allowRawRespondentId?: boolean;
    piiOverrideDenylist?: string[];
    piiPolicyVersion?: number;
  } | null;
}

export interface SurveyWorkflow {
    id: string;
    surveyId: string;
    runtimeJson: any;
    designJson: any;
    status?: "DRAFT" | "PUBLISHED";
    createdAt: string;
    updatedAt: string;
}

export interface QuotaCondition {
    id?: string;
    questionId: string;
    matchType: 'option' | 'number_range' | 'postal_regex' | 'postal_list';
    optionValues: string[];
    minValue?: number;
    maxValue?: number;
    sortOrder?: number;
    isOrphaned?: boolean;
}

export interface SurveyQuota {
    id: string;
    surveyId: string;
    name?: string;
    type: 'screener' | 'survey';
    groupOperator: 'and' | 'or';
    rule?: LogicGroup | null;
    limit: number;
    isActive: boolean;
    isFull: boolean;
    currentCount: number;
    syncId?: string;
    createdAt: string;
    conditions: QuotaCondition[];
}

export interface StartResponseParams {
    id?: string;
    surveyId: string;
    mode?: string;
    respondentId?: string;
}

export interface UpdateResponseParams {
    id: string;
    response?: any;
    status?: string;
    outcome?: string;
    respondentId?: string;
    redirectUrl?: string;
}
