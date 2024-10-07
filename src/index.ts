import { EventEmitter } from 'events';
import { deferred } from 'promise-callbacks';

type PromisePoolOptions =
  | {
      numConcurrent?: number;
      maxPending?: number;
    }
  | number;

class PromisePool extends EventEmitter {
  private _numConcurrent: number;
  private _maxPending: number;
  private _numActive: number;
  private _isDone: boolean;
  private _waitingDone: boolean;
  private _pending: Array<() => void>;
  private _errors: Array<Error>;

  /**
   * Creates a new PromisePool instance to manage concurrent function execution.
   *
   * @description
   * This class limits the number of concurrent functions that can be executed
   * simultaneously. It's useful for controlling resource usage and managing
   * concurrency in asynchronous operations.
   *
   * @param {PromisePoolOptions} options - Configuration options for the pool.
   * @param {number} [options.numConcurrent=4] - The maximum number of functions to run concurrently.
   * @param {number} [options.maxPending=1] - The maximum number of functions that can be queued for execution.
   *
   * @example
   * const pool = new PromisePool({ numConcurrent: 3, maxPending: 5 });
   *
   * @throws {Error} If the pool is used incorrectly (e.g., too many pending functions).
   *
   * @note
   * Always call #flush() after you've finished adding all functions to ensure proper cleanup.
   */
  constructor(options: PromisePoolOptions) {
    super();

    if (!options) {
      options = {};
    }

    if (typeof options === 'number') {
      options = { numConcurrent: options };
    }

    this._maxPending = asPositiveInteger(options.maxPending, 1, 1);
    this._numConcurrent = asPositiveInteger(options.numConcurrent, 4, 1);
    this._numActive = 0;
    this._isDone = false;
    this._waitingDone = false;
    this._pending = [];
    this._errors = [];
  }

  /**
   * Get the number of concurrent functions that can be executed.
   *
   * @returns {number} The number of concurrent functions.
   */
  get numConcurrent(): number {
    return this._numConcurrent;
  }

  /**
   * Get the maximum number of pending functions that can be queued for execution.
   *
   * @returns {number} The maximum number of pending functions.
   */
  get maxPending(): number {
    return this._maxPending;
  }

  /**
   * Attempts to start the function. If there are already `concurrentFactor` functions running that
   * are managed by this pool, this function will yield until the function has been started.
   *
   * @param {Function} fn The function to run.
   * @param {...*} args The arguments to call the function with.
   * @return {Promise} Resolved when the function actually starts.
   */
  async start(fn: (...args: any[]) => Promise<any>, ...args: any[]): Promise<void> {
    if (this._isDone) {
      throw new Error('cannot start function, this pool is done');
    }

    if (typeof fn !== 'function') {
      throw new TypeError('expected a function');
    }

    if (this._numActive >= this._numConcurrent) {
      if (this._pending.length >= this._maxPending) {
        // the pool is likely being used in a manner that does not propagate backpressure
        throw new Error(
          'too many pending invocations: please look for "cannot queue function in pool" in the documentation'
        );
      }
      const task = deferred();
      this._pending.push(task.defer());
      await task;
    }

    ++this._numActive;
    setImmediate(() => {
      fn(...args).then(
        () => this._onJoin(null),
        (err) => this._onJoin(err)
      );
    });
  }

  /**
   * Yields until all started or queued tasks complete, then returns an array of
   * errors encountered during processing, or an empty array if no errors were
   * encountered.
   *
   * @return {Promise<Error[]>} The errors encountered by the functions.
   */
  async flush(): Promise<Error[]> {
    if (!this._numActive) {
      this._isDone = true;
    } else if (!this._isDone) {
      this._waitingDone = true;
      const done = deferred();
      this.once('done', done.defer());
      await done;
    }
    return this._errors;
  }

  private _onJoin(err: Error | null) {
    if (err) this._errors.push(err);

    --this._numActive;
    if (this._pending.length) {
      const taskDone = this._pending.shift();
      if (taskDone) taskDone();
    } else if (!this._numActive && this._waitingDone) {
      this._isDone = true;
      this._waitingDone = false;
      this.emit('done');
    }
  }
}

/**
 * Coerce the input to a positive integer.
 *
 * @param {*} value
 * @param {Number} defaultValue
 * @param {Number} minValue
 * @return {Number}
 */
function asPositiveInteger(value: any, defaultValue: number, minValue: number): number {
  if (typeof value !== 'number') {
    return defaultValue;
  }

  if (value <= 0) {
    return minValue;
  }

  value = value | 0;
  if (value <= 0) {
    return minValue;
  }

  if (value > 0) {
    return value;
  }

  // NaN
  return defaultValue;
}

export default PromisePool;
