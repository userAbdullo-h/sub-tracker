import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  if (process.env.DEV_BYPASS_AUTH === "true") return NextResponse.next();
  const isSignin = req.nextUrl.pathname.startsWith("/signin");
  if (!req.auth && !isSignin) {
    return NextResponse.redirect(new URL("/signin", req.nextUrl));
  }
  if (req.auth && isSignin) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  // api/scan excluded so Vercel Cron's Bearer-token GET isn't redirected to /signin
  matcher: ["/((?!api/auth|api/scan|_next/static|_next/image|favicon.ico).*)"],
};
