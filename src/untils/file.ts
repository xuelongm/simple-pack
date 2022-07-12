import { isAbsolute, resolve } from "path";
import { readFileSync } from 'fs';

function addExt ( id: string ) {
	return id + '.js'
}


export function resolveId(importee: string, importer?: string) {
    if (isAbsolute(importee)) return importee;
    if (importee === undefined) return resolve(process.cwd(), addExt(importee))
}

export function load(id: string) {
    return readFileSync(id).toString();
}