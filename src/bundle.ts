import { InputOption } from "../types";
import { Module } from "./module";
import { resolveId, load } from "./untils/file";

export class Bundle {
  private readonly entry: string;
  public entryModule: Module | null;
  private modules: Module[];
  public moduleById: Map<string, Module>;
  constructor(options: InputOption) {
    const { entry } = options;
    this.entry = entry;
    this.entryModule = null;
    this.modules = [];
    this.moduleById = new Map();
  }

  async build() {
    // 获取当前的id
    const id = resolveId(this.entry);
    try {
      const entryModule = await this.fetchModule(id!);
      this.modules.forEach(module => module.bindImportSpecifiers());
      this.modules.forEach(module => module.bindAliases());
      this.modules.forEach(module => module.bindReferences());
      for(const [name, specifier] of entryModule.exports) {
        const declaration = entryModule.traceExport(name)!;
        console.log(declaration)
        declaration.isExported = true;
        declaration.use();
      }
    } catch (err) {
      console.log(err);
    }
  }

  async fetchModule(id: string) {
    // 获取当前source
    const source = await this.load(id);

    const module = new Module({
      id,
      code: source,
      originalCode: source,
      ast: null,
      bundle: this
    });
    this.moduleById.set(id, module);
    this.modules.push(module);
    await this.fetchAllDependencies(module);
    return module;
  }

  async fetchAllDependencies(module: Module) {
    
    const promises = Array.from(module.dependencies).map(source => {
      const sourceResolveId = resolveId(source, module.id);
      if(!sourceResolveId) {
        module.resolvedIds.set(source, source);
        if (!this.moduleById.has(source)) {

        }
      } else {
        module.resolvedIds.set(source, sourceResolveId);
        return this.fetchModule(sourceResolveId);
      }
    });

    await Promise.all(promises);
  }

  async load(id: string): Promise<string> {
    return load(id);
  }
}
