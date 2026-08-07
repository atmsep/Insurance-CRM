import { redirect } from "next/navigation";
import { getCurrentAgencyUser } from "@/lib/dal";

export default async function Home() {
  const agencyUser = await getCurrentAgencyUser();
  redirect(agencyUser ? "/dashboard" : "/login");
}
