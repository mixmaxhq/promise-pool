# promise-pool

Concurrent control of async function invocation with a pool-like abstraction. Implicitly applies
backpressure to the imperative task producer.

Requires a version of Node that supports [`async`][async]/[`await`][await].

```js
import PromisePool from '@mixmaxhq/promise-pool';

async function sample() {
  // Cap the concurrent function execution at 10.
  const pool = new PromisePool({ numConcurrent: 10 });

  // Call an async function 1000000 times. The pool ensures that no more than
  // 10 will be executing at a time.
  for (const i = 0; i < 1000000; ++i) {
    // The await suspends the for loop until the function has started.
    await pool.start(async (i) => {
      await sendResult(await getResult(i));

      // When this function returns, the pool will allow the currently
      // suspended pool.start to complete, allowing the for loop to
      // resume.
    }, i);

    // Note that because we are using let in the for loop, we could rely on the
    // closured i binding instead of passing it through pool.start.
  }

  // Wait for all the queued and running functions to finish.
  const errors = await pool.flush();

  // We only log this once every result has been sent.
  if (errors.length) {
    console.log('done with errors', errors);
  } else {
    console.log('done');
  }
}
```

If this strikes you as similar to [batch][], that's because it is. It differs, however, in that it
has built-in backpressure, to simplify writing concurrent code that avoids loading everything into
memory. This module is a rewrite of the [synchronize-pool][] module, but instead of using
synchronize, it uses async/await.

## Install

We're hoping to use the `promise-pool` package name, but it's currently occupied.

```sh
$ npm install @mixmaxhq/promise-pool
```

or

```sh
$ npm i @mixmaxhq/promise-pool
```

## Changelog

- 3.0.0 Migrate codebase to TypeScript for improved type safety and developer experience.

- 2.0.0 Add `maxPending` option to avoid problematic usage (see new [Troubleshooting](#troubleshooting) section)

- 1.1.1 Move `ava` and `ava-spec` to `devDependencies`.

- 1.1.0 Adds transpilation so it can be used in Node 6 (and prior) environments.

- 1.0.0 Initial release.

## Troubleshooting

### `cannot queue function in pool`

If you're getting this error, then you're calling `start` too many times
concurrently. Please read on - one of two things is happening:

- you're not waiting for the previous `start` call to resolve before calling `start` again
- you're adding items to the pool in multiple places

In the former case, you probably have code that looks like this:

```js
import _ from 'lodash';
import mongoist from 'mongoist';

const db = mongoist(...);

async function startJobs() {
  const pool = new PromisePool({numConcurrent: 4});

  // Pull in an array of users (high memory usage, poor performance
  // characteristics due to loading all instead of streaming with something
  // like promise-iterate).
  const users = await db.users.findAsCursor().toArray();

  // _.each doesn't wait on the promise returned by each invocation, so it
  // won't apply backpressure to the loop in the manner pool.start expects.
  // This will also not catch any error raised by pool.start, and will cause
  // recent versions of Node to crash due to an unhandled rejection!
  _.each(users, async (user) => {
    await pool.start(async () => {
      await queue.publish(user);
    });
  });

  await pool.flush();
}
```

Instead, you need to use some iteration method that preserves backpressure, like the `for`-`of` loop:

```js
async function startJobs() {
  const pool = new PromisePool({ numConcurrent: 4 });

  // Still severely suboptimal.
  const users = await db.users.findAsCursor().toArray();

  for (const user of users) {
    // Now the await applies to the `startJobs` async function instead of
    // the anonymous async function.
    await pool.start(async () => {
      await queue.publish(user);
    });
  }

  await pool.flush();
}
```

Or even better, couple this with a call to `promise-iterate` to only load users as you need them:

```js
import promiseIterate from 'promise-iterate';

async function startJobs() {
  const pool = new PromisePool({ numConcurrent: 4 });

  const users = await db.users.findAsCursor();

  // promise-iterate correctly applies backpressure, and helpfully iterates
  // the cursor without pulling in all results as an array.
  await promiseIterate(users, async (user) => {
    // The await still applies to the `startJobs` async function due to the
    // behavior of promise-iterate.
    await pool.start(async () => {
      await queue.publish(user);
    });
  });

  await pool.flush();
}
```

The other case is where you're using `promise-pool` in multiple places, and
thus you'll need to use `maxPending` to tell `promise-pool` that you know what
you're doing:

```js
async function initializeAllUsers() {
  const pool = new PromisePool({
    numConcurrent: 4,

    // Important: without this, we'll fail almost immediately after starting to
    // kick off the first job and starting to send the first email.
    maxPending: 2,
  });

  const users = await db.users.findAsCursor();

  // Some cursor-compatible tee implementation.
  const [usersA, usersB] = tee(users);

  await Promise.all([
    startJobs(pool, usersA),
    sendEmails(pool, usersB),
  });

  await pool.flush();
}

async function startJobs(pool, users) {
  await promiseIterate(users, async (user) => {
    await pool.start(async () => {
      await queue.publish(user);
    });
  });
}

async function sendEmails(pool, users) {
  await promiseIterate(users, async (user) => {
    await pool.start(async () => {
      await sendEmail(user);
    });
  });
}
```

## License

> The MIT License (MIT)
>
> Copyright &copy; 2017 Mixmax, Inc ([mixmax.com](https://mixmax.com))
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in allcopies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[async]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
[await]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await
[batch]: https://github.com/visionmedia/batch/
[synchronize-pool]: https://github.com/mixmaxhq/synchronize-pool
