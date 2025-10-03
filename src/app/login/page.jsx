"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GoHeartFill } from "react-icons/go";
import Swal from "sweetalert2";

/** Normalisasi nomor HP ke format 62…. */
function normalizePhone(input = "") {
  const p = String(input).replace(/[^\d]/g, "");
  if (!p) return "";
  return p.startsWith("0") ? "62" + p.slice(1) : p; // 08… -> 628…
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function fetchFreshSession() {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const norm = normalizePhone(phone);
    if (!norm.startsWith("62")) {
      Swal.fire({
        title: "Warning!",
        text: "Nomor HP harus diawali dengan 62.",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#7e22ce",
      });
      setLoading(false);
      return;
    }
    if (!password) {
      Swal.fire({
        title: "Warning!",
        text: "Password tidak boleh kosong.",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#7e22ce",
      });
      setLoading(false);
      return;
    }

    try {
      const res = await signIn("credentials", {
        phone: norm,
        password,
        redirect: false,
      });

      if (!res || res.error) {
        const msg =
          res?.error === "User not found"
            ? "Nomor HP atau password salah!"
            : res?.error || "Terjadi kesalahan. Coba lagi.";
        Swal.fire({
          title: "Error!",
          text: msg,
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#7e22ce",
        });
        setLoading(false);
        return;
      }

      // Ambil session paling baru langsung dari API NextAuth
      // (lebih stabil daripada getSession di App Router)
      let s = null;
      for (let i = 0; i < 4; i++) {
        s = await fetchFreshSession();
        if (s?.user?.id) break;
        await new Promise((r) => setTimeout(r, 150));
      }

      const role = s?.user?.role?.toLowerCase?.() || "";
      const uid = s?.user?.id || null;

      // simpan ke localStorage sebagai fallback untuk halaman /guru
      try {
        if (s?.user) {
          localStorage.setItem("user", JSON.stringify(s.user));
        }
        if (role === "guru" && uid) {
          localStorage.setItem("guruId", String(uid));
        } else {
          localStorage.removeItem("guruId");
        }
      } catch {}

      if (role === "guru") {
        router.replace("/guru");
      } else if (role === "siswa") {
        router.replace("/");
      } else {
        router.replace("/login");
      }
    } catch (error) {
      console.error("Login error:", error);
      Swal.fire({
        title: "Error!",
        text: "Terjadi kesalahan di server. Silakan coba lagi.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#7e22ce",
      });
    } finally {
      setLoading(false);
    }
  };

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
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading}
              inputMode="numeric"
              autoComplete="username"
            />
            <motion.input
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.8 }}
              type="password"
              placeholder="Password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading}
              autoComplete="current-password"
            />

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.8 }}
              type="submit"
              className="w-full py-2 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Loading..." : "Log In"}
            </motion.button>
          </form>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 flex flex-row justify-center items-center gap-2">
          <p className="opacity-80">Raka - Made with</p>
          <GoHeartFill color="magenta" />
        </div>
      </motion.div>
    </div>
  );
}
