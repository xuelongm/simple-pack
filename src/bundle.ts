import { InputOption } from "../types";
import { Module } from "./module";
import { resolveId, load } from "./untils/file";

export class Bundle {
  private readonly entry: string;
  private entryModule: Module | null;
  private modules: Module[];
  private moduleById: Map<string, Module>;
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
      this.modules.forEach(module => module);
      
    } catch(err) {
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
    })

  }

  async load(id: string): Promise<string> {
    return load(id);
  }
}
