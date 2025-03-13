import { NextResponse } from "next/server";

export async function middleware(req) {
  const token = req.cookies.get("token");
  const { pathname } = req.nextUrl;

  // Jika user belum login dan mencoba mengakses dashboard ("/"), arahkan ke "/login"
  if (!token && pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

// Middleware hanya untuk halaman "/"
export const config = {
  matcher: ["/"],
};
