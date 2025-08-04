import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import DashboardWhisnap from "@/components/DashboardWhisnap";

export const dynamic = "force-dynamic";

// This is a private page: It's protected by the layout.js component which ensures the user is authenticated.
// It's a server compoment which means you can fetch data (like the user profile) before the page is rendered.
// See https://shipfa.st/docs/tutorials/private-page
export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  return <DashboardWhisnap user={session?.user} />;
}
