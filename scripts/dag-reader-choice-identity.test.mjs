import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import ts from 'typescript';

const loadDagReader = async () => {
    let source = readFileSync(new URL('../src/shared/engine/DagReader.ts', import.meta.url), 'utf8');
    source = source.replace(
        /import \{ matchesStructuredItemKey, resolveStructuredItemKey \} from [^;]+;/,
        `const resolveStructuredItemKey = (item, fallback = '') => item?.exportId || item?.technicalId || item?.value || item?.id || fallback;
const matchesStructuredItemKey = (item, key) => Boolean(item) && [resolveStructuredItemKey(item), item.value, item.id, item.technicalId, item.exportId].includes(String(key));`,
    );
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
};

const { DAGReader } = await loadDagReader();

const pasta = {
    label: 'Pasta',
    value: 'opt-pasta',
    id: 'legacy-pasta-id',
    technicalId: 'technical-pasta',
    exportId: 'export-pasta',
};
const aliases = [pasta.label, pasta.value, pasta.id, pasta.technicalId, pasta.exportId];

const graphFor = (conditionValue, operator = 'equals') => ({
    food: {
        id: 'food',
        type: 'singleChoice',
        data: { options: [pasta, { label: 'Rice', value: 'opt-rice', exportId: 'export-rice' }] },
        skips: [{
            condition: {
                type: 'group',
                logicType: 'AND',
                children: [{ type: 'rule', field: 'food', operator, value: conditionValue, valueType: 'static' }],
            },
            targetId: 'rate',
        }],
        next: { kind: 'linear', nextId: 'normal' },
    },
    rate: { id: 'rate', type: 'rating', data: {}, next: { kind: 'linear', nextId: null } },
    normal: { id: 'normal', type: 'singleChoice', data: {}, next: { kind: 'linear', nextId: null } },
});

describe('Flow Tester choice identity routing', () => {
    test('matches every saved-condition alias against every submitted-answer alias', () => {
        for (const conditionAlias of aliases) {
            const reader = new DAGReader(graphFor(conditionAlias));
            for (const answerAlias of aliases) {
                assert.equal(
                    reader.getNextNode('food', { food: answerAlias })?.id,
                    'rate',
                    `${answerAlias} should match condition ${conditionAlias}`,
                );
            }
        }
    });

    test('still follows normal flow for a different option', () => {
        const reader = new DAGReader(graphFor(pasta.value));
        assert.equal(reader.getNextNode('food', { food: 'export-rice' })?.id, 'normal');
    });

    test('canonicalizes stable IDs inside multiple-choice answers', () => {
        const reader = new DAGReader(graphFor(pasta.value, 'contains'));
        assert.equal(reader.getNextNode('food', { food: [pasta.exportId] })?.id, 'rate');
    });
});

const emptyCondition = () => ({
    type: 'group',
    logicType: 'AND',
    children: [],
});

describe('Flow Tester empty conditions', () => {
    test('treats an empty destination condition as no visibility condition', () => {
        const graph = {
            start: {
                id: 'start',
                type: 'start',
                data: {},
                next: { kind: 'linear', nextId: 'question' },
            },
            question: {
                id: 'question',
                type: 'textInput',
                data: { condition: emptyCondition() },
                next: { kind: 'linear', nextId: 'end' },
            },
            end: { id: 'end', type: 'end', data: {}, next: null },
        };
        const errors = [];
        const originalError = console.error;
        console.error = (...args) => errors.push(args);

        try {
            const reader = new DAGReader(graph);
            assert.equal(reader.getNextNode('start', {})?.id, 'question');
            assert.deepEqual(errors, []);
        } finally {
            console.error = originalError;
        }
    });

    test('ignores an unfinished nested group while evaluating configured rules', () => {
        const graph = {
            start: {
                id: 'start',
                type: 'start',
                data: {},
                next: { kind: 'linear', nextId: 'conditional' },
            },
            food: {
                id: 'food',
                type: 'singleChoice',
                data: { options: [pasta, { label: 'Rice', value: 'opt-rice', exportId: 'export-rice' }] },
                next: null,
            },
            conditional: {
                id: 'conditional',
                type: 'textInput',
                data: {
                    condition: {
                        type: 'group',
                        logicType: 'AND',
                        children: [
                            emptyCondition(),
                            { type: 'rule', field: 'food', operator: 'equals', value: pasta.exportId, valueType: 'static' },
                        ],
                    },
                },
                next: { kind: 'linear', nextId: 'end' },
            },
            end: { id: 'end', type: 'end', data: {}, next: null },
        };

        const reader = new DAGReader(graph);
        assert.equal(reader.getNextNode('start', { food: 'export-rice' })?.id, 'end');
    });

    test('still rejects a decision node with no configured rule', () => {
        const reader = new DAGReader({
            decision: {
                id: 'decision',
                type: 'branch',
                data: { condition: emptyCondition() },
                next: { kind: 'branch', trueId: 'yes', falseId: 'no' },
            },
        });

        assert.throws(
            () => reader.getNextNode('decision', {}),
            /Decision node decision has no condition defined/,
        );
    });
});
