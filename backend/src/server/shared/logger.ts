export function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), service: 'uninerd-backend', event, ...fields }));
}
