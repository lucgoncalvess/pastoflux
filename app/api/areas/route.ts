import { apiError, createArea, listAreas } from "@/lib/server";
export async function GET(request: Request) { try { const farmId = Number(new URL(request.url).searchParams.get("farmId")); if (!Number.isInteger(farmId) || farmId < 1) throw new Error("Fazenda inválida."); return Response.json({ areas: await listAreas(request, farmId) }); } catch (error) { return apiError(error); } }
export async function POST(request: Request) { try { return await createArea(request); } catch (error) { return apiError(error); } }
