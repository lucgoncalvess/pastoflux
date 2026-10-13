import { apiError, updateFarm } from "@/lib/server";
export async function PATCH(request: Request) { try { return await updateFarm(request); } catch (error) { return apiError(error); } }
