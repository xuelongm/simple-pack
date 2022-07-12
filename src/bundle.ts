import { InputOption } from "../types";
import { Module } from "./module";
import { resolveId, load } from "./untils/file";

export class Bundle {
  private readonly entry: string;
  private entryModule: Module | null;
  constructor(options: InputOption) {
    const { entry } = options;
    this.entry = entry;
    this.entryModule = null;
  }

  async build() {
    // 获取当前的id
    const id = resolveId(this.entry);
    const entryModule = await this.fetchModule(id!);
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
