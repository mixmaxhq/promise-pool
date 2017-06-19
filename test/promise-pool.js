const expect = require('chai').expect;
const { deferred } = require('promise-callbacks');

const PromisePool = require('..');

describe('PromisePool', function() {
  it('should limit concurrent execution to 1', async function() {
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

    expect(await pool.flush()).to.deep.equal([]);

    ops.push(6);

    expect(ops).to.deep.equal([0, 1, 2, 3, 4, 5, 6]);
  });

  it('should limit concurrent execution to 3', async function() {
    const startOrder = [], endOrder = [];

    const actions = new Map();

    async function pause(n) {
      expect(actions.has(n)).to.be.false;
      const action = deferred();
      actions.set(n, action.defer());
      await action;
    }

    function resume(n) {
      expect(actions.has(n)).to.be.true;
      const fn = actions.get(n);
      expect(fn).to.be.a('function');
      actions.delete(n);
      fn();
    }

    const pool = new PromisePool(3);

    function waiter(id) {
      return async () => {
        startOrder.push(id);
        await pause(id);
        endOrder.push(id);
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

    expect(await pool.flush()).to.deep.equal([]);

    endOrder.push(5);

    expect(startOrder).to.deep.equal([0, 1, 2, 3, 4]);
    expect(endOrder).to.deep.equal([1, 2, 0, 4, 3, 5]);
  });

  it('should work with a cursor', async function() {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9],
      cursor = new Cursor(array);

    let hits = 0;

    const pool = new PromisePool(4);

    for (let value; (value = await cursor.next()); ) {
      await pool.start(async () => {
        expect(value).to.equal(array[hits++]);
        await delay((Math.random() * 10) | 0);
      });
    }

    expect(await pool.flush()).to.deep.equal([]);

    expect(hits).to.equal(9);
  });
});

class Cursor {
  constructor(array) {
    this._array = array;
    this._index = 0;
  }

  async next() {
    return this._array.length === this._index ? null : this._array[this._index++];
  }
}

function immediately() {
  return new Promise((resolve) => setImmediate(resolve));
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
