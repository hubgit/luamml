/**
 * Web Worker that exposes a "LaTeX math to MathML" API.
 *
 * Post a message with:
 *   { id, latex, options? }
 * where `options` is an optional {@link RenderOptions} object.
 *
 * The worker replies with either:
 *   { id, mathml }   on success, or
 *   { id, error }    on failure.
 */

import { renderToString, ParseError } from './latex.js';
import type { RenderOptions } from './latex.js';

export interface WorkerRequest {
  id: number | string;
  latex: string;
  options?: RenderOptions;
}

export interface WorkerResponseOk {
  id: number | string;
  mathml: string;
}

export interface WorkerResponseErr {
  id: number | string;
  error: string;
}

export type WorkerResponse = WorkerResponseOk | WorkerResponseErr;

// In a Worker context `self` is the global scope with postMessage/addEventListener.
// We avoid pulling in DOM lib types by using a minimal interface.
interface WorkerScope {
  addEventListener(type: 'message', listener: (event: { data: WorkerRequest }) => void): void;
  postMessage(message: WorkerResponse): void;
}

const ctx = globalThis as unknown as WorkerScope;

ctx.addEventListener('message', (event) => {
  const { id, latex, options } = event.data;
  try {
    const mathml = renderToString(latex, options);
    ctx.postMessage({ id, mathml });
  } catch (err) {
    const message =
      err instanceof ParseError ? err.message : String(err);
    ctx.postMessage({ id, error: message });
  }
});
