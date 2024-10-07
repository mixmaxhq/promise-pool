import { deferred, delay } from 'promise-callbacks';
import PromisePool from '../src';

class Cursor {
  private _array: any[];
  private _index: number;

  constructor(array: any[]) {
    this._array = array;
    this._index = 0;
  }

  async next(): Promise<any | null> {
    return this._array.length === this._index ? null : this._array[this._index++];
  }
}

describe('PromisePool', () => {
  it('should keep compability with constructor number', async () => {
    const pool = new PromisePool(2);
    expect(pool.numConcurrent).toBe(2);
    expect(pool.maxPending).toBe(1);
  });

  it('should limit concurrent execution to 1', async () => {
    const ops: number[] = [];

    const pool = new PromisePool({ numConcurrent: 1 });

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

    expect(await pool.flush()).toEqual([]);

    ops.push(6);

    expect(ops).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('should limit concurrent execution to 3', async () => {
    const startOrder: number[] = [];
    const endOrder: number[] = [];

    const actions = new Map<number, () => void>();

    function pause(n: number): Promise<void> {
      expect(actions.has(n)).toBe(false);
      const action = deferred<void>();
      actions.set(n, action.defer());
      return action;
    }

    function resume(n: number): void {
      expect(actions.has(n)).toBe(true);
      const fn = actions.get(n);
      expect(typeof fn).toBe('function');
      actions.delete(n);
      fn?.();
    }

    const pool = new PromisePool({ numConcurrent: 3 });

    function waiter(id: number) {
      return async () => {
        startOrder.push(id);
        await pause(id).then(() => endOrder.push(id));
      };
    }

    await pool.start(waiter(0));
    await pool.start(waiter(1));
    await pool.start(waiter(2));

    setImmediate(() => {
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

    expect(await pool.flush()).toEqual([]);

    endOrder.push(5);

    expect(startOrder).toEqual([0, 1, 2, 3, 4]);
    expect(endOrder).toEqual([1, 2, 0, 4, 3, 5]);
  });

  it('should work with a cursor', async () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const cursor = new Cursor(array);

    let hits = 0;

    const pool = new PromisePool({ numConcurrent: 4 });

    for (let value: any; (value = await cursor.next()); ) {
      await pool.start(async () => {
        expect(value).toBe(array[hits++]);
        await delay((Math.random() * 10) | 0);
      });
    }

    expect(await pool.flush()).toEqual([]);
    expect(hits).toBe(9);
  });

  it('should guard against lack of backpressure', async () => {
    const array = [1, 2, 3, 4, 5];

    const pool = new PromisePool({ numConcurrent: 2 });

    const res: Promise<void>[] = [];

    res.push(
      (async () => {
        array.forEach(() => res.push(pool.start(async () => {})));
      })()
    );

    await expect(Promise.all(res)).rejects.toThrow(/cannot queue function in pool/);
  });

  it('should allow more than one pending start', async () => {
    const array = [1, 2, 3, 4, 5];

    const pool = new PromisePool({ numConcurrent: 2, maxPending: 2 });

    async function useArray() {
      for (const item of array) {
        await pool.start(async () => {}, item);
      }
    }

    await expect(Promise.all([useArray(), useArray()])).resolves.not.toThrow();
  });

  it('should restrict excessive pending usage', async () => {
    const array = [1, 2, 3, 4, 5];

    const pool = new PromisePool({ numConcurrent: 2, maxPending: 2 });

    async function useArray() {
      for (const item of array) {
        await pool.start(async () => {}, item);
      }
    }

    await expect(Promise.all([useArray(), useArray(), useArray()])).rejects.toThrow(
      /cannot queue function in pool/
    );
  });
});

function immediately(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
