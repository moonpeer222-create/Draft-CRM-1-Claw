export async function withRetry<T>(fn: () => Promise<T>, label = "op", maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.log(`[Retry] ${label} failed (attempt ${i + 1}/${maxRetries}):`, err.message || err);
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    }
  }
  throw lastError;
}
