export interface LogicRule {
    id: string;
    type: 'rule';
    field: string;
    subField?: string;
    compareField?: string;
    operator: string;
    value: any;
    valueType: 'static' | 'variable';
}

export interface LogicGroup {
    id?: string;
    type: 'group';
    logicType: 'AND' | 'OR';
    children: LogicItem[];
}

export type LogicItem = LogicGroup | LogicRule;
