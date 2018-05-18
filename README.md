promise-pool
============

Concurrent control of async function invocation with a pool-like abstraction. Implicitly applies
backpressure to the imperative task producer.

Requires a version of Node that supports [`async`][async]/[`await`][await].

```js
const PromisePool = require('@mixmaxhq/promise-pool');

async function sample() {
  // Cap the concurrent function execution at 10.
  const pool = new PromisePool(10);

  // Call an async function 1000000 times. The pool ensures that no more than
  // 10 will be executing at a time.
  for (let i = 0; i < 1000000; ++i) {
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
  await pool.flush();

  // We only log this once every result has been sent.
  console.log('done');
}
```

If this strikes you as similar to [batch][], that's because it is. It differs, however, in that it
has built-in backpressure, to simplify writing concurrent code that avoids loading everything into
memory. This module is a rewrite of the [synchronize-pool][] module, but instead of using
synchronize, it uses async/await.

Install
-------

We're hoping to use the `promise-pool` package name, but it's currently occupied.

```sh
$ npm install @mixmaxhq/promise-pool
```

or

```sh
$ npm i @mixmaxhq/promise-pool
```

Changelog
---------
* 1.1.1 Move `ava` and `ava-spec` to `devDependencies`.

* 1.1.0 Adds transpilation so it can be used in Node 6 (and prior) environments.

* 1.0.0 Initial release.

License
-------

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
