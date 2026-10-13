import { apiError, updateTask } from "@/lib/server";
export async function PATCH(request: Request) { try { return await updateTask(request); } catch (error) { return apiError(error); } }
