import { walk } from "estree-walker";
import { BaseNode, Literal, BaseCallExpression, MemberExpression } from "estree";
import { Declaration, Scope } from "./ast/scope";
import { Module } from "./module";
import attachScopes from './ast/attachScopes';

const modifierNodes = {
	AssignmentExpression: 'left',
	UpdateExpression: 'argument'
};

function isReference ( node: any, parent: any ): boolean {
	if ( node.type === 'MemberExpression' ) {
		return !node.computed && isReference( node.object, node );
	}

	if ( node.type === 'Identifier' ) {
		// TODO is this right?
		if ( parent.type === 'MemberExpression' ) return parent.computed || node === parent.object;

		// disregard the `bar` in { bar: foo }
		if ( parent.type === 'Property' && node !== parent.value ) return false;

		// disregard the `bar` in `class Foo { bar () {...} }`
		if ( parent.type === 'MethodDefinition' ) return false;

		// disregard the `bar` in `export { foo as bar }`
		if ( parent.type === 'ExportSpecifier' && node !== parent.local ) return false;

		return true;
	}
    return false;
}

export class Reference<T extends BaseNode> {
    public readonly node: T;
    public readonly scope: Scope;
    public declaration: any;
    public readonly parts: T[];
    public readonly name: string;
    public readonly start: number;
    public readonly end: number;

    public isImmediatelyUsed: boolean;
    public isReassignment: boolean;
    constructor(node: T, scope: Scope) {
        this.node = node;
        this.scope = scope;
        this.declaration = null;

        this.parts = [];

        let root: any = node;
        while(root.type === 'MemberExpression') {
            this.parts.unshift(root);
            root = (root as unknown as MemberExpression).object as T;
        }

        this.isReassignment = false;
        this.isImmediatelyUsed = false;

        this.name = (root as any).name;

        this.start = root.start;
        this.end = root.end;
    }   
}

function isIife ( node: BaseNode, parent: BaseNode ) {
	return parent && parent.type === 'CallExpression' && node === (parent as BaseCallExpression).callee;
}

export class Statement {
    public readonly node: BaseNode;
    private readonly module: Module;
    private readonly start: number;
    private readonly end: number;
    private isIncluded: boolean;
    private isImportDeclaration: boolean;
    private isExportDeclaration: boolean;
    public readonly scope: Scope;

    private stringLiteralRanges: [number, number][];
    public references: Reference<BaseNode>[];

    constructor(node: BaseNode, module: Module, start: number, end: number) {
        this.node = node;
        this.module = module;
        this.start = start;
        this.end = end;


        this.isIncluded = false;
        this.isImportDeclaration = node.type === 'ImportDeclaration';
        this.isExportDeclaration = /^Export/.test(node.type);

        this.stringLiteralRanges = [];
        this.references = [];

        this.scope = new Scope();
    }

    public getFieldByKey(key: 'node' | 'node' | 'start' | 'end' | 'isIncluded' | 'isImportDeclaration' | 'isExportDeclaration' | 'scope'): BaseNode | Module | number | boolean | Scope {
        return this[key];
    }

    public analyse() {
        if(this.isImportDeclaration) return;

        attachScopes(this);

        this.scope.eachDeclaration((key: string, declaration: Declaration) => {
            declaration.statement = this;
        });

        let { module, references, scope, stringLiteralRanges } = this;
        let readDepth = 0;

        walk(this.node, {
            enter(node, parent) {
                // `aasdasd${i}dasdasd`
                if (node.type === 'TemplateElement') {
                    stringLiteralRanges.push([(node as any).start, (node as any).end]);
                }
                if (node.type === 'Literal' && typeof (node as Literal).value === 'string' && /\n/.test( (node as Literal).raw! ) ) {
                    stringLiteralRanges.push([(node as any).start + 1, (node as any).end - 1]);
                }
                if ((node as any)._scope) {
                    scope = (node as any)._scope
                }
                if ( /Function/.test( node.type ) && !isIife( node, parent ) ) readDepth += 1;

                let isReassignment = false;
                if (parent && parent.type in modifierNodes) {
                    let subject = (parent as any)[ modifierNodes[parent.type as keyof typeof modifierNodes] ];
                    let depth = 0;
                    while(subject.type === 'MemberExpression') {
                        subject = subject.object;
                        depth++;
                    }
                    const importDeclaration = module.imports.get(subject.name);
                    if (!scope.contains(subject.name) && importDeclaration) {
                        const minDepth = importDeclaration.name === '*' ?
							2 : // cannot do e.g. `namespace.foo = bar`
							1;
                        if (depth < minDepth) {
                            throw new Error(`Illegal reassignment to import '${subject.name}'`)
                        }
                    }

                    isReassignment = !depth;
                }

                if (isReference(node, parent)) {
                    const referenceScope = parent.type === 'FunctionDeclaration' && node === (parent as any).id ?
						scope.parent :
						scope;
                    const reference = new Reference( node, referenceScope );
                    references.push( reference );
                    reference.isImmediatelyUsed = !readDepth;
                    reference.isReassignment = isReassignment;

                    this.skip();
                }
            },
            leave ( node, parent ) {
				if ( (node as any)._scope ) scope = scope.parent;
				if ( /Function/.test( node.type ) && !isIife( node, parent ) ) readDepth -= 1;
			}
        });
    }

    mark() {
        if ( this.isIncluded ) return;
        this.isIncluded = true;
        
        this.references.forEach( reference => {
			if ( reference.declaration ) reference.declaration.use();
		});
    }
}