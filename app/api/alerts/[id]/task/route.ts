import { apiError, convertAlertToTask, idFromUrl } from "@/lib/server";

export async function POST(request: Request) {
  try {
    return await convertAlertToTask(request, idFromUrl(request));
  } catch (error) {
    return apiError(error);
  }
}
