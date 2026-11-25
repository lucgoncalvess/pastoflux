import { apiError, convertAlertToTask } from "@/lib/server";

export async function POST(request: Request) {
  try {
    // URL: /api/alerts/{id}/task — o id é o penúltimo segmento.
    const segments = new URL(request.url).pathname.split("/").filter(Boolean);
    const id = Number(segments[segments.length - 2]);
    if (!Number.isInteger(id) || id < 1) throw new Error("Identificador inválido.");
    return await convertAlertToTask(request, id);
  } catch (error) {
    return apiError(error);
  }
}
