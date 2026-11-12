import { apiError, listAlerts } from "@/lib/server";

export async function GET(request: Request) {
  try {
    const farmId = Number(new URL(request.url).searchParams.get("farmId"));
    if (!Number.isInteger(farmId) || farmId < 1) throw new Error("Fazenda inválida.");
    return Response.json({ alerts: await listAlerts(request, farmId) });
  } catch (error) {
    return apiError(error);
  }
}
