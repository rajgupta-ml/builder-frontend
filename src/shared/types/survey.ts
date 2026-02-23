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

export interface SurveyQuota {
    id: string;
    surveyId: string;
    name?: string;
    rule: any; // Can be LogicGroup or a simple rule object
    limit: number;
    isActive: boolean;
    createdAt: string;
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

// Logic types for workflow conditions
export interface LogicRule {
    type: 'rule';
    field: string;
    subField?: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'gt' | 'lt' | 'is_set' | 'is_empty' | 'is_between' | 'in_range' | 'not_in_range';
    value: any;
    valueType?: 'static' | 'variable';
}

export interface LogicGroup {
    type: 'group';
    logicType: 'AND' | 'OR';
    children: (LogicGroup | LogicRule)[];
}
