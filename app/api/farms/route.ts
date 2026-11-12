import { apiError, createFarm, listFarms } from "@/lib/server";
export async function GET(request: Request) { try { return Response.json({ farms: await listFarms(request) }); } catch (error) { return apiError(error); } }
export async function POST(request: Request) { try { return await createFarm(request); } catch (error) { return apiError(error); } }
