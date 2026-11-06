import { apiError, closeRentalOffer, idFromUrl, updateRentalOffer } from "@/lib/server";

export async function PATCH(request: Request) {
  try { return await updateRentalOffer(request, idFromUrl(request)); }
  catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try { return await closeRentalOffer(request, idFromUrl(request)); }
  catch (error) { return apiError(error); }
}
