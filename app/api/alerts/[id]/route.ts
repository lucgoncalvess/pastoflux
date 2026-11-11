import { apiError, idFromUrl, markAlertRead } from "@/lib/server";

export async function PATCH(request: Request) {
  try {
    return await markAlertRead(request, idFromUrl(request));
  } catch (error) {
    return apiError(error);
  }
}
