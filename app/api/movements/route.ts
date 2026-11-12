import { apiError, createMovement, listMovements } from "@/lib/server";

export async function GET(request: Request) {
  try {
    const farmId = Number(new URL(request.url).searchParams.get("farmId"));
    if (!Number.isInteger(farmId) || farmId < 1) throw new Error("Fazenda inválida.");
    return Response.json({ movements: await listMovements(request, farmId) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try { return await createMovement(request); } catch (error) { return apiError(error); }
}
