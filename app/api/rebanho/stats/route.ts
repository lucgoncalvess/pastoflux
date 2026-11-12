import { apiError, herdStats } from "@/lib/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const farmId = Number(url.searchParams.get("farmId"));
    if (!Number.isInteger(farmId) || farmId < 1) throw new Error("Fazenda inválida.");
    return Response.json(await herdStats(request, farmId, url.searchParams));
  } catch (error) { return apiError(error); }
}
