import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ClipboardList, LogOut, PackageSearch, ListChecks } from "lucide-react";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function AppShell({ children, user }: { children: React.ReactNode; user: { name: string; role: string } }) {
  async function signOut() { "use server"; await logout(); redirect("/"); }
  return <div className="min-h-screen">
    <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3"><Link href="/dashboard" className="text-xl font-bold text-primary">Yaser Mall Stock</Link><div className="flex items-center gap-3 text-sm"><span>{user.name} - {user.role}</span><form action={signOut}><Button size="sm" variant="outline"><LogOut className="h-4 w-4" /> Sign out</Button></form></div></div></header>
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]"><nav className="flex gap-2 md:flex-col"><Link className="rounded-md px-3 py-2 hover:bg-muted" href="/dashboard"><BarChart3 className="mr-2 inline h-4 w-4" />Dashboard</Link><Link className="rounded-md px-3 py-2 hover:bg-muted" href="/admin/items"><ListChecks className="mr-2 inline h-4 w-4" />Item Plan</Link><Link className="rounded-md px-3 py-2 hover:bg-muted" href="/products"><PackageSearch className="mr-2 inline h-4 w-4" />Products</Link><Link className="rounded-md px-3 py-2 hover:bg-muted" href="/reports"><ClipboardList className="mr-2 inline h-4 w-4" />Reports</Link></nav><main>{children}</main></div>
  </div>;
}
