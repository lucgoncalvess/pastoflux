import { apiError, requestRentalContact } from "@/lib/server";

export async function POST(request: Request) {
  try {
    const segments = new URL(request.url).pathname.split("/").filter(Boolean);
    const offerId = Number(segments[segments.length - 2]);
    if (!Number.isInteger(offerId) || offerId < 1) throw new Error("Identificador inválido.");
    return await requestRentalContact(request, offerId);
  }
  catch (error) { return apiError(error); }
}
