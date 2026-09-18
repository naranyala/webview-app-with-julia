// Serializes project mutations so autosave, imports, and explicit saves cannot
// overwrite one another with stale document snapshots.
export function createProjectMutationQueue() {
  let tail = Promise.resolve();

  return {
    run(operation) {
      if (typeof operation !== 'function') {
        return Promise.reject(new TypeError('Project mutation must be a function'));
      }
      const result = tail.then(operation, operation);
      tail = result.catch(() => {});
      return result;
    }
  };
}

export async function flushBeforeProjectMutation(flush) {
  const flushed = await flush();
  if (flushed === false) {
    throw new Error('Pending project changes could not be saved.');
  }
}
