import { apiError, listFarmOccupations } from "@/lib/server";

export async function GET(request: Request) {
  try {
    const farmId = Number(new URL(request.url).searchParams.get("farmId"));
    if (!Number.isInteger(farmId) || farmId < 1) throw new Error("Fazenda inválida.");
    return Response.json({ occupations: await listFarmOccupations(request, farmId) });
  } catch (error) { return apiError(error); }
}
