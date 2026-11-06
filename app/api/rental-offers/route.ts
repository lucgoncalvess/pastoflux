import { apiError, createRentalOffer, listRentalOffers } from "@/lib/server";

export async function GET(request: Request) {
  try { return Response.json({ offers: await listRentalOffers(request) }); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try { return await createRentalOffer(request); }
  catch (error) { return apiError(error); }
}
