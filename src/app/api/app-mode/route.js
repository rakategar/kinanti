export async function GET() {
  const mode = process.env.APP_MODE || "production";
  return Response.json({ mode });
}
