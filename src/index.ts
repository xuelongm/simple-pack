import { InputOption } from '../types';
import { Bundle } from './bundle';
export function simplePack(option: InputOption) {
    const { entry } = option;
    if (!entry) {
        throw new Error( 'You must supply options.entry to semplePack' );
    }
    const bundle = new Bundle(option);
    bundle.build();
}