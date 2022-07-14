import { parse, type Node } from 'acorn';
import MagicString from 'magic-string';
import { walk } from 'estree-walker';
import { BaseModuleDeclaration, ExportNamedDeclaration, ImportDeclaration } from 'estree'

import { Bundle } from './bundle';
import { Statement } from './statement';
import { Declaration } from './ast/scope';

export interface ModeleOption {
    id: string;
    code: string;
    originalCode: string;
    ast: any;
    bundle: Bundle
}

export class Module {
    public readonly id: string;
    private readonly code: string;
    private readonly originalCode: string;
    private readonly bundle: Bundle;
    // 处理注释内容
    private comments: any[];
    private statements: Statement[];
    private magicString: MagicString;

    public dependencies: Set<string>;
    public imports: Map<string, {source: string, name: string, module: null | Module}>;
    public exports: Map<string, {localName: string}>;

    public resolvedIds: Map<string, string>;

    public declarations: Map<string, Declaration>;

    constructor(options: ModeleOption) {
        const { id, code, originalCode, ast, bundle } = options;
        this.id = id;
        this.code = code;
        this.originalCode = originalCode;

        this.bundle = bundle;
        this.comments = [];
        this.statements = [];

        this.dependencies = new Set();
        this.imports = new Map();
        this.exports = new Map();
        this.declarations = new Map();
        this.resolvedIds = new Map();

        this.magicString = new MagicString(code, {
            filename: id,
            indentExclusionRanges: []
        })

        this.statements = this.parse(ast);

        this.analyse();
    }

    parse(ast: import("estree").Program) {
        if (!ast) {
            try {
                ast = parse(this.code, {
                    ecmaVersion: 6,
                    sourceType: 'module',
                    onComment: (block, text, start, end) => {
                        this.comments.push({block, text, start, end})
                    },
                    preserveParens: true
                }) as unknown as import("estree").Program;
            } catch(err) {
                throw err;
            }
        }
        walk(ast, {
            enter: (node: any) => {
                this.magicString.addSourcemapLocation( node.start );
				this.magicString.addSourcemapLocation( node.end );
            }
        })

        let statements: Statement[] = [];
        let lastChar = 0;
        let commentIndex = 0;
        ast.body.forEach((node: any) => {
            // let comment;
            // do {
            //     comment = this.comments[commentIndex];
            //     if (!comment) break;
            //     if (comment.start > (node as any).start) break;
            //     commentIndex++;
            // } while(comment.end < lastChar);
            const statement = new Statement(node, this, node.start, node.end);
            statements.push( statement );
        })

        return statements;
    }

    addImport(statement: Statement) {
        const node = statement.getFieldByKey('node') as ImportDeclaration;
        const source = node.source.value as string;
        if (!this.dependencies.has(source)) {
            this.dependencies.add(source);
        }
        const {specifiers} = node;
        for(const specifier of specifiers) {
            const localName = specifier.local.name;
            if (this.imports.has(localName)) {
                const err = new Error( `Duplicated import '${localName}'` ) as any;
                err.file = this.id;
                throw err;
            }
            const isDefault = specifier.type === 'ImportDefaultSpecifier';
			const isNamespace = specifier.type === 'ImportNamespaceSpecifier';

			const name = isDefault ? 'default' : isNamespace ? '*' : specifier.imported.name;
            this.imports.set(localName, {source, name, module: null })
        }
    }

    addExport(statement: Statement) {
        const node = statement.getFieldByKey('node') as BaseModuleDeclaration;
        // export { name } from 'other' ;
        // todo
        // const source = node.source?.value;

        if (node.type === 'ExportNamedDeclaration') {
            const { specifiers, declaration } = node as ExportNamedDeclaration;
            // export {name, age};
            if (specifiers.length) {
                for(const specifier of specifiers) {
                    const localName = specifier.local.name;
                    const exportedName = specifier.exported.name;
                    this.exports.set(exportedName, {localName});
                }
            } else if (declaration){
                let name;
                if (declaration.type === 'VariableDeclaration') {
                    name = (declaration.declarations[0].id as any).name;
                } else {
                    name = declaration.id?.name;
                }
                this.exports.set(name, {localName: name})
            }
        }
        
    }

    analyse() {
        this.statements.forEach(statement => {
            if (statement.getFieldByKey('isImportDeclaration')) this.addImport(statement);
            else if (statement.getFieldByKey('isExportDeclaration')) this.addExport(statement);
            statement.analyse();

            statement.scope.eachDeclaration( ( name: string, declaration:Declaration ) => {
				this.declarations.set(name, declaration);
			});
        });
    }

    bindImportSpecifiers() {
        for(const [_, specifier] of this.imports) {
            const id = this.resolvedIds.get(specifier.source);
            specifier.module = this.bundle.moduleById.get(id!)!;
        }
    }

    bindAliases() {
        for(const [name, declaration] of this.declarations) {
            const { statement } = declaration;
            for (const reference of statement!.references) {
                if (reference.name === name || !reference.isImmediatelyUsed) {
                    continue;
                }
                const otherDeclaration = this.trace( reference.name );
               
            }
        }
    }

    bindReferences() {
        for (const statement of this.statements) {
            if (statement.node.type === 'ExportNamedDeclaration' && (statement.node as ExportNamedDeclaration).specifiers.length) {
                if (this === this.bundle.entryModule) {
                    return;
                }
            }

            statement.references.forEach(reference => {
                const declaration = reference.scope.findDeclaration(reference.name) || this.trace(reference.name);
                if (declaration) {
                    declaration.addReference(reference);
                } else {
                    // 全局变量，如console

                    // console.log(reference);
                }
                
            });  
        }
    }

    trace(name: string): Declaration | undefined {
        if (this.declarations.has(name)) {
            return this.declarations.get(name);
        }
        if (this.imports.has(name)) {
            const declaration = this.imports.get(name)!;
            const otherModule = declaration.module!;
            return otherModule.traceExport(name);
        }
    }

    traceExport(name: string): Declaration | undefined {
        const exportDeclaration = this.exports.get(name);
        if (exportDeclaration) {
           return this.trace(exportDeclaration.localName);
        }
    }
}