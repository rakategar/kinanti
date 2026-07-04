import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Jika belum login → arahkan ke /login
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = (token.role || "").toLowerCase();

  // Jika siswa mencoba akses /guru → arahkan ke / (halaman siswa)
  if (pathname.startsWith("/guru") && role === "siswa") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Jika guru mencoba akses / (halaman siswa) → arahkan ke /guru
  if (pathname === "/" && role === "guru") {
    return NextResponse.redirect(new URL("/guru", req.url));
  }

  // Jika tidak ada masalah, lanjutkan request
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/guru/:path*"], // lindungi halaman siswa dan guru
};
