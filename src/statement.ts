import { walk } from "estree-walker";
import { BaseNode, Literal, BaseCallExpression } from "estree";
import { Declaration, Scope } from "./ast/scope";
import { Module } from "./module";
import attachScopes from './ast/attachScopes';

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
    return true;
}

class Reference {
    constructor() {}
}

function isIife ( node: BaseNode, parent: BaseNode ) {
	return parent && parent.type === 'CallExpression' && node === (parent as BaseCallExpression).callee;
}

export class Statement {
    private readonly node: BaseNode;
    private readonly module: Module;
    private readonly start: number;
    private readonly end: number;
    private isInclude: boolean;
    private isImportDeclaration: boolean;
    private isExportDeclaration: boolean;
    private readonly scope: Scope;

    private stringLiteralRanges: [number, number][];
    private references: Reference[];

    constructor(node: BaseNode, module: Module, start: number, end: number) {
        this.node = node;
        this.module = module;
        this.start = start;
        this.end = end;


        this.isInclude = false;
        this.isImportDeclaration = node.type === 'ImportDeclaration';
        this.isExportDeclaration = /^Export/.test(node.type);

        this.stringLiteralRanges = [];
        this.references = [];

        this.scope = new Scope();
    }

    public getFieldByKey(key: 'node' | 'node' | 'start' | 'end' | 'isInclude' | 'isImportDeclaration' | 'isExportDeclaration' | 'scope'): BaseNode | Module | number | boolean | Scope {
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




            }
        })
    }
}