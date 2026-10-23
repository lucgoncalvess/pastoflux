import { apiError, updateAnimal } from "@/lib/server";

export async function PATCH(request: Request) {
  try { return await updateAnimal(request); } catch (error) { return apiError(error); }
}
