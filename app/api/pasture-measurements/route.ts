import { apiError, createMeasurement, listMeasurements } from "@/lib/server";

export async function GET(request: Request) {
  try {
    const areaId = Number(new URL(request.url).searchParams.get("areaId"));
    if (!Number.isInteger(areaId) || areaId < 1) throw new Error("Área inválida.");
    return Response.json({ measurements: await listMeasurements(request, areaId) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try { return await createMeasurement(request); } catch (error) { return apiError(error); }
}
