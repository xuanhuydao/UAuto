// src/core/utils/task-pool.js
export class TaskPool {
  constructor(concurrency = 10) {
    if (!Number.isInteger(concurrency) || concurrency <= 0) {
      throw new Error("TaskPool: concurrency must be a positive integer")
    }
    this.concurrency = concurrency
    this.running = 0
    this.queue = []
  }

  run(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject })
      this._drain()
    })
  }

  _drain() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { taskFn, resolve, reject } = this.queue.shift()
      this.running++

      Promise.resolve()
        .then(taskFn)
        .then(resolve, reject)
        .finally(() => {
          this.running--
          this._drain()
        })
    }
  }
}
