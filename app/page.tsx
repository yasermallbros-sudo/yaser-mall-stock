import { redirect } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { login, getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function homeForRole(role: string) { return role === "EMPLOYEE" ? "/employee" : "/dashboard"; }

export default async function LoginPage() {
  const currentUser = await getCurrentUser();
  if (currentUser) redirect(homeForRole(currentUser.role));
  async function action(formData: FormData) {
    "use server";
    const user = await login(String(formData.get("email")), String(formData.get("password")));
    if (user) redirect(homeForRole(user.role));
    redirect("/?error=1");
  }
  return <main className="grid min-h-screen place-items-center px-4"><Card className="w-full max-w-md"><CardHeader><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground"><PackageCheck /></div><CardTitle>Yaser Mall Stock</CardTitle><p className="text-sm text-muted-foreground">Sign in to audit inventory accuracy.</p></CardHeader><CardContent><form action={action} className="space-y-4"><div><Label>Email</Label><Input name="email" type="email" required /></div><div><Label>Password</Label><Input name="password" type="password" required /></div><Button className="w-full">Sign in</Button></form></CardContent></Card></main>;
}
