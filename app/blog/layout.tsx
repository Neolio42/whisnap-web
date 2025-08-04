import { Suspense } from "react";
import NavHeader from "@/components/NavHeader";
import Footer from "@/components/Footer";

export default async function LayoutBlog({ children }: { children: any }) {
  return (
    <div className="min-h-screen bg-whisnap-bg-light dark:bg-whisnap-bg-dark">
      <NavHeader variant="app" />

      <main className="min-h-screen max-w-6xl mx-auto p-8 pt-24">{children}</main>

      <div className="h-24" />

      <Footer />
    </div>
  );
}
