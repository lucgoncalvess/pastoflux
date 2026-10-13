import { apiError, updateArea } from "@/lib/server";
export async function PATCH(request: Request) { try { return await updateArea(request); } catch (error) { return apiError(error); } }
