"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GoHeartFill } from "react-icons/go";
import { FiEye, FiEyeOff } from "react-icons/fi";
import Swal from "sweetalert2";

/** Normalisasi nomor HP ke format 62…. */
function normalizePhone(input = "") {
  const p = String(input).replace(/[^\d]/g, "");
  if (!p) return "";
  return p.startsWith("0") ? "62" + p.slice(1) : p; // 08… -> 628…
}

export default function Home() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const { data: session, status } = useSession();

  // Redirect jika sudah login
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const role = session.user.role?.toLowerCase?.() || "";
      if (role === "guru") {
        router.replace("/guru");
      } else if (role === "siswa") {
        router.replace("/");
      }
    }
  }, [status, session, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Cegah double submit
    if (isSubmitting || isRedirecting) return;

    setIsSubmitting(true);

    const norm = normalizePhone(phone);
    if (!norm.startsWith("62")) {
      Swal.fire({
        title: "Nomor HP Tidak Valid",
        text: "Nomor HP harus diawali dengan 628",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#7e22ce",
      });
      setIsSubmitting(false);
      return;
    }
    if (!password) {
      Swal.fire({
        title: "Password Kosong",
        text: "Silakan masukkan password Anda.",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#7e22ce",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await signIn("credentials", {
        phone: norm,
        password,
        redirect: false,
      });

      console.log("[Login] signIn response:", res);

      // Handle error dari signIn
      if (!res) {
        Swal.fire({
          title: "Gagal Login",
          text: "Terjadi kesalahan koneksi. Silakan coba lagi.",
          icon: "error",
          confirmButtonText: "Coba Lagi",
          confirmButtonColor: "#7e22ce",
        });
        setIsSubmitting(false);
        return;
      }

      if (res.error) {
        // Error spesifik dari NextAuth
        let errorTitle = "Login Gagal";
        let errorMessage =
          "Silakan periksa kembali nomor HP dan password Anda.";

        if (
          res.error === "CredentialsSignin" ||
          res.error === "User not found"
        ) {
          errorTitle = "Nomor HP atau Password Salah";
          errorMessage =
            "Pastikan nomor HP dan password yang Anda masukkan sudah benar.";
        } else if (res.error.includes("fetch")) {
          errorTitle = "Koneksi Bermasalah";
          errorMessage =
            "Gagal terhubung ke server. Periksa koneksi internet Anda.";
        }

        Swal.fire({
          title: errorTitle,
          text: errorMessage,
          icon: "error",
          confirmButtonText: "Coba Lagi",
          confirmButtonColor: "#7e22ce",
        });
        setIsSubmitting(false);
        return;
      }

      // Login berhasil - jangan enable tombol lagi, langsung redirect
      if (res.ok) {
        setIsRedirecting(true);

        // Simpan ke localStorage sebagai fallback
        try {
          localStorage.setItem("loginPhone", norm);
        } catch {}

        // Tampilkan loading saat redirect
        Swal.fire({
          title: "Login Berhasil!",
          text: "Mengalihkan ke dashboard...",
          icon: "success",
          timer: 1500,
          timerProgressBar: true,
          showConfirmButton: false,
          allowOutsideClick: false,
          allowEscapeKey: false,
        });

        // Fetch session untuk dapat role
        let retries = 0;
        let userRole = null;
        let userId = null;

        while (retries < 5 && !userRole) {
          await new Promise((r) => setTimeout(r, 300));
          try {
            const sessionRes = await fetch("/api/auth/session", {
              cache: "no-store",
              credentials: "include",
            });
            if (sessionRes.ok) {
              const sessionData = await sessionRes.json();
              console.log("[Login] Session data:", sessionData);
              if (sessionData?.user?.role) {
                userRole = sessionData.user.role.toLowerCase();
                userId = sessionData.user.id;

                // Simpan ke localStorage
                try {
                  localStorage.setItem(
                    "user",
                    JSON.stringify(sessionData.user),
                  );
                  if (userRole === "guru" && userId) {
                    localStorage.setItem("guruId", String(userId));
                  }
                } catch {}
              }
            }
          } catch (err) {
            console.log("[Login] Session fetch error:", err);
          }
          retries++;
        }

        // Redirect berdasarkan role
        console.log("[Login] Redirecting, role:", userRole);

        // Gunakan window.location untuk redirect yang lebih reliable
        if (userRole === "guru") {
          window.location.href = "/guru";
        } else if (userRole === "siswa") {
          window.location.href = "/";
        } else {
          // Fallback: redirect ke halaman utama (siswa)
          window.location.href = "/";
        }

        return; // Jangan lanjutkan eksekusi
      }
    } catch (error) {
      console.error("[Login] Error:", error);
      Swal.fire({
        title: "Terjadi Kesalahan",
        text: "Gagal menghubungi server. Silakan coba lagi nanti.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#7e22ce",
      });
      setIsSubmitting(false);
    }
  };

  // Tampilkan loading jika sedang cek session
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  // Disable form jika sedang submit atau redirect
  const isDisabled = isSubmitting || isRedirecting;

  return (
    <div className="flex min-h-screen">
      {/* Kiri - Gambar (desktop) */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="hidden md:flex flex-1/3 flex-col items-center justify-center p-10 bg-gradient-to-r from-violet-400 to-purple-300 relative"
      >
        <Link className="absolute top-0 left-8" href="/">
          <Image src="/logo.png" alt="Logo" width={150} height={150} />
        </Link>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <Image
            src="/gambarLogin.png"
            alt="Login Illustration"
            width={500}
            height={500}
            priority
          />
        </motion.div>
      </motion.div>

      {/* Kanan - Form Login */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="flex-1 flex flex-col justify-center items-center p-6 bg-white"
      >
        {/* Logo mobile */}
        <Link className="md:hidden absolute top-6 left-6" href="/">
          <Image src="/logo.png" alt="Logo" width={120} height={120} />
        </Link>

        {/* Card Form */}
        <div className="w-full max-w-md p-6">
          <motion.h2
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-2xl font-bold text-center text-gray-800"
          >
            Welcome Back! 👋
          </motion.h2>
          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="text-gray-600 text-center mt-2 w-full"
          >
            Sign in to continue
          </motion.p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <motion.input
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              type="text"
              placeholder="62xxxxxxxxxxx"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isDisabled}
              inputMode="numeric"
              autoComplete="username"
            />
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.8 }}
              className="relative"
            >
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 pr-11 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isDisabled}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                tabIndex={-1}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.8 }}
              type="submit"
              className="w-full py-2 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isDisabled}
            >
              {isRedirecting ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Mengalihkan...</span>
                </>
              ) : isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Memproses...</span>
                </>
              ) : (
                "Log In"
              )}
            </motion.button>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.1, duration: 0.8 }}
              className="text-center mt-4"
            >
              <span className="text-gray-600">Belum punya akun? </span>
              <Link href="/register" className="text-purple-500">
                Daftar di sini
              </Link>
            </motion.div>
          </form>
        </div>

        {/* Footer */}
        <a
          href="https://wa.me/62895378394020?text=Permisi%20mas%20Raka"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-6 flex flex-row justify-center items-center gap-2 hover:opacity-70 transition cursor-pointer"
        >
          <p className="opacity-80">Raka - Made with</p>
          <GoHeartFill color="magenta" />
        </a>
      </motion.div>
    </div>
  );
}
