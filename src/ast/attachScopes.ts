import { walk } from "estree-walker";
import { Statement } from "../statement";
import { Scope } from "./scope";
import { BaseModuleDeclaration, VariableDeclaration, FunctionExpression } from 'estree'

const blockDeclarations = {
	'const': true,
	'let': true
};


export default function attachScopes(statement: Statement) {
    const node = statement.getFieldByKey('node') as BaseModuleDeclaration;
    let scope = statement.getFieldByKey('scope') as Scope;

    walk(node,  {
        enter: (node, parent) => {
            const { type } = node;
            // function foo() {}
            // class foo {}
            // 將function和class加入到当前scope
            if (/(Function|Class)Declaration/.test(type)) {
                scope.addDeclaration(node, false, false);
            }

            if (node.type === 'VariableDeclaration') {
                const isBlockDeclaration = blockDeclarations[ (node as VariableDeclaration).kind as keyof typeof blockDeclarations ];
                scope.addDeclaration((node as VariableDeclaration).declarations[0], isBlockDeclaration, false);
            }

            let newScope;

            if(/Function/.test( node.type )) {
                newScope = new Scope({
                    parent: scope,
                    params: (node as any).params,
                    block: false
                });
                if (node.type === 'FunctionExpression' && (node as FunctionExpression).id) {
                    newScope.addDeclaration(node, false, false);
                }
            }

            if (node.type === 'BlockStatement' && !/Function/.test( parent.type )) {
                newScope = new Scope({
                    parent: scope,
                    block: true
                });
            }

            if (newScope) {
                Reflect.defineProperty(node,  '_scope', {
                    value: newScope,
                    configurable: true
                });
                scope = newScope;
            }
        }, 
        leave: (node: any) => {
            if (node._scope) {
                scope = node._scope.parent;
            }
        }
    })
}