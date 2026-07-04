import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, PackageCheck } from "lucide-react";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function EmployeeShell({ children, user }: { children: React.ReactNode; user: { name: string; role: string } }) {
  async function signOut() { "use server"; await logout(); redirect("/"); }
  return <div className="min-h-screen bg-background">
    <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/employee" className="flex items-center gap-2 text-lg font-bold text-primary"><PackageCheck className="h-5 w-5" />Yaser Mall Stock</Link>
        <div className="flex items-center gap-3 text-sm"><span>{user.name}</span><form action={signOut}><Button size="sm" variant="outline"><LogOut className="h-4 w-4" /> Sign out</Button></form></div>
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
  </div>;
}
