import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/employee") {
    const url = request.nextUrl.clone();
    url.pathname = "/employee-safe";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/employee"]
};
