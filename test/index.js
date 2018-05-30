import { describe } from 'ava-spec';
import { deferred } from 'promise-callbacks';

const PromisePool = require('..');

class Cursor {
  constructor(array) {
    this._array = array;
    this._index = 0;
  }

  async next() {
    return this._array.length === this._index ? null : this._array[this._index++];
  }
}

describe('PromisePool', (it) => {
  it('should limit concurrent execution to 1', async (t) => {
    const ops = [];

    const pool = new PromisePool(1);

    await pool.start(async () => {
      ops.push(1);
      await immediately();
      ops.push(2);
    });

    ops.push(0);

    await pool.start(async () => {
      ops.push(4);
      await immediately();
      ops.push(5);
    });

    ops.push(3);

    t.deepEqual(await pool.flush(), []);

    ops.push(6);

    t.deepEqual(ops, [0, 1, 2, 3, 4, 5, 6]);
  });

  it('should limit concurrent execution to 3', async (t) => {
    const startOrder = [], endOrder = [];

    const actions = new Map();

    function pause(n) {
      t.is(actions.has(n), false);
      const action = deferred();
      actions.set(n, action.defer());
      // We can't await this action because it messes up the resolution order in Node 8 in the
      // waiter.
      return action;
    }

    function resume(n) {
      t.is(actions.has(n), true);
      const fn = actions.get(n);
      t.is(typeof fn, 'function');
      actions.delete(n);
      fn();
    }

    const pool = new PromisePool(3);

    function waiter(id) {
      return async () => {
        startOrder.push(id);
        // We used to just use await here, but then a Node 8 regression caused:
        // https://github.com/mixmaxhq/promise-pool/issues/5
        await pause(id).then(() => endOrder.push(id));
      };
    }

    await pool.start(waiter(0));
    await pool.start(waiter(1));
    await pool.start(waiter(2));

    setImmediate(() => {
      // After we've yielded pending the next pool#start:
      resume(1);
      resume(2);
      resume(0);
    });

    await pool.start(waiter(3));
    await pool.start(waiter(4));

    setImmediate(() => {
      resume(4);
      resume(3);
    });

    t.deepEqual(await pool.flush(), []);

    endOrder.push(5);

    t.deepEqual(startOrder, [0, 1, 2, 3, 4]);
    t.deepEqual(endOrder, [1, 2, 0, 4, 3, 5]);
  });

  it('should work with a cursor', async (t) => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9],
      cursor = new Cursor(array);

    let hits = 0;

    const pool = new PromisePool(4);

    for (let value; (value = await cursor.next()); ) {
      await pool.start(async () => {
        t.is(value, array[hits++]);
        await delay((Math.random() * 10) | 0);
      });
    }

    t.deepEqual(await pool.flush(), []);

    t.is(hits, 9);
  });
});

function immediately() {
  return new Promise((resolve) => setImmediate(resolve));
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
