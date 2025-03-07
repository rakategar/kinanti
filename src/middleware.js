import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Jika user belum login dan mencoba mengakses dashboard ("/"), arahkan ke "/login"
  if (!token && pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

// Tentukan halaman yang ingin diawasi oleh middleware
export const config = {
  matcher: ["/"], // Middleware hanya berlaku untuk halaman dashboard "/"
};
