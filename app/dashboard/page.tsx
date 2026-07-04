import { AlertTriangle, BadgeCheck, Boxes, CameraOff, Clock3, DollarSign, PackageX, PencilLine, RefreshCw, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";
import { getLiveProductData } from "@/lib/live-products-file";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Stat({ title, value, icon: Icon }: { title: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-5 w-5 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-bold">{value}</div></CardContent></Card>;
}

function syncDate(value: string) {
  return new Intl.DateTimeFormat("en-JO", { dateStyle: "full", timeStyle: "medium" }).format(new Date(value));
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [s, live] = await Promise.all([getDashboardStats(), getLiveProductData({ forceFresh: true })]);

  return <AppShell user={user}><div className="space-y-6"><h1 className="text-2xl font-bold">Dashboard</h1><Card className="border-primary/30"><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base font-semibold">Live Yaser sync</CardTitle><RefreshCw className="h-5 w-5 text-primary" /></CardHeader><CardContent className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_1fr]"><div className="space-y-1"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" />Real-time sync date and time</p><p className="text-xl font-bold">{syncDate(live.fetchedAt)}</p></div><div><p className="text-sm text-muted-foreground">Live products</p><p className="text-2xl font-bold">{live.uniqueProductCount.toLocaleString()}</p></div><div><p className="text-sm text-muted-foreground">Yaser in stock</p><p className="text-2xl font-bold text-primary">{live.inStock.toLocaleString()}</p></div><div><p className="text-sm text-muted-foreground">Yaser out stock</p><p className="text-2xl font-bold text-destructive">{live.outOfStock.toLocaleString()}</p></div></CardContent></Card><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat title="Total products" value={s.totalProducts} icon={Boxes} /><Stat title="Products checked today" value={s.checkedToday} icon={BadgeCheck} /><Stat title="Out of stock" value={s.byStatus.OUT_OF_STOCK ?? 0} icon={PackageX} /><Stat title="Low stock" value={s.byStatus.LOW_STOCK ?? 0} icon={AlertTriangle} /><Stat title="Wrong image" value={s.byStatus.WRONG_IMAGE ?? 0} icon={CameraOff} /><Stat title="Wrong price" value={s.byStatus.WRONG_PRICE ?? 0} icon={DollarSign} /><Stat title="Wrong name" value={s.byStatus.WRONG_NAME ?? 0} icon={PencilLine} /><Stat title="Employees" value={s.employees.length} icon={Users} /></section><section><h2 className="mb-3 text-lg font-semibold">Employee statistics</h2><div className="grid gap-3 md:grid-cols-2">{s.employees.map((e) => <Card key={e.id}><CardContent className="flex items-center justify-between pt-5"><div><p className="font-medium">{e.name}</p><p className="text-sm text-muted-foreground">{e.role}</p></div><p className="text-2xl font-bold">{e._count.auditReports}</p></CardContent></Card>)}</div></section></div></AppShell>;
}
