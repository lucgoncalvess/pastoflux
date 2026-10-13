import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { farms } from "@/db/schema";
import { apiError, createFarm } from "@/lib/server";

export async function GET() { try { return Response.json({ farms: await getDb().select().from(farms).orderBy(asc(farms.name)) }); } catch (error) { return apiError(error); } }
export async function POST(request: Request) { try { return await createFarm(request); } catch (error) { return apiError(error); } }
