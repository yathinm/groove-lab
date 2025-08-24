declare module 'essentia.js/dist/essentia-wasm.web.js' {
  const factory: (config?: { locateFile?: (p: string) => string }) => Promise<any>;
  export default factory;
}

declare module 'essentia.js/dist/essentia.js-core.es.js' {
  export const Essentia: new (mod: any) => any;
  const _default: new (mod: any) => any;
  export default _default;
}
