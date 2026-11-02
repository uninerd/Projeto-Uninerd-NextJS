export function GET() {
  return Response.json({ service: 'uninerd-backend', health: '/api/health', readiness: '/api/ready' });
}
