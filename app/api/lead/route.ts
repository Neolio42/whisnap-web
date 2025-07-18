import { NextResponse, NextRequest } from "next/server";
import prisma from "@/libs/prisma";

// This route is used to store the leads that are generated from the landing page.
// The API call is initiated by <ButtonLead /> component
// Duplicate emails just return 200 OK
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const existingLead = await prisma.lead.findUnique({
      where: { email: body.email }
    });

    if (!existingLead) {
      await prisma.lead.create({
        data: { email: body.email }
      });

      // Here you can add your own logic
      // For instance, sending a welcome email (use the the sendEmail helper function from /libs/mailgun)
    }

    return NextResponse.json({});
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
