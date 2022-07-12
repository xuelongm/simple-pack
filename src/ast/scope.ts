import { BaseModuleDeclaration } from 'estree';
import { Identifier, ObjectPattern, AssignmentProperty, RestElement, ArrayPattern, AssignmentPattern } from 'estree';
import { Statement } from '../statement';

const extractors = {
	Identifier ( names: string[], param: Identifier ): void {
		names.push( param.name );
	},

	ObjectPattern ( names: string[], param: ObjectPattern ): void {
		param.properties.forEach( prop => {
			extractors.Identifier( names, (prop as AssignmentProperty).key as Identifier );
		});
	},

	ArrayPattern ( names: string[], param: ArrayPattern ): void {
		param.elements.forEach( element => {
			if ( element ) extractors.Identifier( names, element as Identifier );
		});
	},

	RestElement ( names: string[], param: RestElement ): void{
		extractors.Identifier( names, param.argument as Identifier);
	},

	AssignmentPattern ( names: string[], param: AssignmentPattern ): void {
		return extractors.Identifier( names, param.left as Identifier);
	}
};

function extractNames ( param: any ): string[] {
	const names: string[] = [];
	extractors[ param.type as keyof typeof extractors ]( names, param );
	return names;
}

export class Declaration {
    public statement: Statement | null;
    public name: string | null;
    public isReassigned: boolean;
    public aliases: string[];
    constructor (name: string) {
		this.statement = null;
		this.name = name;

		this.isReassigned = false;
		this.aliases = [];
	}
}

export interface ScopeOption {
    parent?: Scope;
    block?: any;
    params?: any[];
}

export class Scope {
    private readonly parent: Scope;
    private isBlockScope: boolean;

    private readonly declarations: Map<string, Declaration>;
    constructor(options: ScopeOption = {}) {
        const { parent,  params, block} = options;
        this.parent = parent as Scope;
        this.isBlockScope = !!block;
        this.declarations = new Map();
    }

    addDeclaration(node: BaseModuleDeclaration, isBlockDeclaration: boolean, isVar: boolean) {
        if (!isBlockDeclaration && this.isBlockScope) {
            this.parent.addDeclaration(node, isBlockDeclaration, isVar);
        } else {
            extractNames((node as any).id).forEach(name => {
                this.declarations.set(name, new Declaration( name ))
            })
        }
    }

    eachDeclaration ( fn: Function ) {
		for(const [key, value] of this.declarations) {
            fn(key, value);
        }
	}
}