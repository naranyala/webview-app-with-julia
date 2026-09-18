const MAX_ENTRIES = 300;
const entries = [];
const sessionId = `frontend-${Date.now().toString(36)}`;

export function recordFrontendDiagnostic(input) {
  const entry = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    level: input.level || 'info',
    source: 'frontend',
    event: input.event || 'application.event',
    requestId: input.requestId || '',
    operation: input.operation || '',
    code: input.code || '',
    message: input.message || '',
    category: input.category || 'application',
    recoverable: input.recoverable === true,
    details: { sessionId, ...(input.details || {}) },
    ...(Number.isFinite(input.durationMs) && { durationMs: input.durationMs })
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES)
    entries.splice(0, entries.length - MAX_ENTRIES);
  return entry;
}

export function frontendDiagnostics() {
  return entries.map((entry) => JSON.parse(JSON.stringify(entry)));
}

export function clearFrontendDiagnostics() {
  entries.length = 0;
}
