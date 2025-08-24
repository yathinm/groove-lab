export function createAudioContext(): AudioContext {
  const Ctx = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    throw new Error('Web Audio API is not supported in this browser.');
  }
  return new Ctx();
}


