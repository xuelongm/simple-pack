import { simplePack } from "../src";
import path from 'path';

simplePack({
    entry: path.resolve('test/src/index.js')
});