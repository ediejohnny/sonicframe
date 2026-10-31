/**
 * `sonicframe/analysis`: the pure sound-analysis functions on their own entry, safe to import in
 * Node or a worker with no DOM in the graph (a server can write a sound's description or its
 * waveform file ahead, say). The same functions are on the main entry too.
 */

export * from './core/analysis';
export * from './core/describe';
export * from './core/waveform';
