import { EMPHASIS_TONE, id, items, list, object, oneOf, text, uniqueIds } from '../spec-kit.js';
import { MAX_CLASSES, MAX_CLASS_RELATIONS, withoutMarks, checkEnds, cycleOf } from './r3-common.js';
export function defineClassDiagramPart(builder) {
    return {
        type: 'classDiagram',
        anchors: 'classes',
        description: "A UML class diagram: classes with attributes and methods, and relations. inherit and implement run from the child to the parent (triangle at the parent); compose and aggregate put the diamond on `from`, the whole; arrow is a directed association, depend a dashed dependency, assoc a plain line. Parents are placed above.",
        schema: object({
            type: { const: 'classDiagram' },
            classes: list(object({
                id: id('The class name, referred to by relations (shown unless name is given).'),
                name: text('The shown name, when it differs from the id.', 40),
                stereotype: text('Shown above the name in «»: interface, enum ...', 20),
                abstract: { type: 'boolean', description: 'true: an abstract class.' },
                attrs: list(text("One attribute: '- id: number'.", 60), 10),
                methods: list(text("One method: '+ save(): void'.", 60), 10),
                tone: EMPHASIS_TONE,
            }, ['id']), MAX_CLASSES, 1),
            relations: list(object({
                from: id('A class id (the child, or the whole for compose / aggregate).'),
                to: id('A class id.'),
                kind: { ...oneOf('assoc', 'arrow', 'inherit', 'implement', 'compose', 'aggregate', 'depend'), description: 'Default assoc.' },
                label: text('The name of the relation.', 30),
                fromMult: text("Multiplicity at from: '1', '0..*'.", 8),
                toMult: text('Multiplicity at to.', 8),
            }, ['from', 'to']), MAX_CLASS_RELATIONS),
            dir: { ...oneOf('down', 'right', 'auto'), description: 'down: parents on top (default, turning when it does not fit); right: left to right.' },
        }, ['type', 'classes', 'relations']),
        example: { type: 'classDiagram', classes: [{ id: 'Animal', abstract: true, methods: ['+ speak(): string'] }, { id: 'Dog', attrs: ['- name: string'], methods: ['+ speak(): string'] }, { id: 'Owner', attrs: ['- name: string'] }], relations: [{ from: 'Dog', to: 'Animal', kind: 'inherit' }, { from: 'Owner', to: 'Dog', kind: 'aggregate', fromMult: '1', toMult: '0..*' }] },
        check(part, at, issues) {
            const classes = uniqueIds(part, 'classes', at, issues);
            checkEnds(part, at, 'relations', classes, 'class id', issues);
            const up = items(part, 'relations').flatMap(r => r['kind'] === 'inherit' || r['kind'] === 'implement' ? [[r['from'], r['to']]] : []);
            const loop = cycleOf([...classes], up);
            if (loop)
                issues.push({ path: `${at}.relations`, message: `inherit / implement go round in a circle: ${loop.join(' -> ')}` });
            items(part, 'relations').forEach((r, i) => { if (r['from'] === r['to'] && (r['kind'] === 'inherit' || r['kind'] === 'implement'))
                issues.push({ path: `${at}.relations[${i}].to`, message: 'a class cannot be its own parent' }); });
        },
        build(part) {
            const { classes, relations, ...opts } = withoutMarks(part);
            return builder(classes, relations, opts);
        },
    };
}
