const Emitter = require('events').EventEmitter;
const { deferred } = require('promise-callbacks');

class PromisePool extends Emitter {
  /**
   * Limits the number of concurrent functions started by calling #start().
   *
   * You should _only_ #flush() after you've have no more functions to start.
   *
   * @param {Number} concurrentFactor The maximum number of functions to let run concurrently.
   */
  constructor(concurrentFactor) {
    super();

    this._numConcurrent = asPositiveInteger(concurrentFactor, 4, 1);
    this._numActive = 0;
    this._isDone = false;
    this._waitingDone = false;
    this._pending = [];
    this._errors = [];
  }

  /**
   * Attempts to start the function. If there are already `concurrentFactor` functions running that
   * are managed by this pool, this function will yield until the function has been started.
   *
   * @param {Function} fn The function to run.
   * @param {...*} args The arguments to call the function with.
   * @return {Promise} Resolved when the function actually starts.
   */
  async start(fn, ...args) {
    if (this._isDone) {
      throw new Error('cannot start function, this pool is done');
    }

    if (typeof fn !== 'function') {
      throw new TypeError('expected a function');
    }

    if (this._numActive >= this._numConcurrent) {
      const task = deferred();
      this._pending.push(task.defer());
      await task;
    }

    ++this._numActive;
    setImmediate(() => {
      fn(...args).then((value) => this._onJoin(null), (err) => this._onJoin(err));
    });
  }

  /**
   * Yields until all started or queued tasks complete, then returns an array of
   * errors encountered during processing, or an empty array if no errors were
   * encountered.
   *
   * @return {Promise<Error[]>} The errors encountered by the functions.
   */
  async flush() {
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

  _onJoin(err) {
    if (err) this._errors.push(err);

    --this._numActive;
    if (this._pending.length) {
      const taskDone = this._pending.shift();
      taskDone();
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
function asPositiveInteger(value, defaultValue, minValue) {
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

module.exports = PromisePool;
