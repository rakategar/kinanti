"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GoHeartFill } from "react-icons/go";
import Swal from "sweetalert2";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validasi nomor HP
    if (!phone.startsWith("62")) {
      Swal.fire({
        title: "Warning!",
        text: "Nomor HP harus diawali dengan 62.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      setLoading(false);
      return;
    }

    try {
      const res = await signIn("credentials", {
        phone,
        password,
        redirect: false,
      });

      if (res.error) {
        if (res.error === "User not found") {
          // Jika error 401 (nomor HP atau password salah)
          Swal.fire({
            title: "Nomor HP atau password salah !",
            icon: "error",
            confirmButtonText: "OK",
          });
        } else {
          // Error lainnya
          Swal.fire({
            title: "Error!",
            text: res.error,
            icon: "error",
            confirmButtonText: "OK",
          });
        }
        setLoading(false);
        return;
      }

      // Jika login berhasil
      router.replace("/");
    } catch (error) {
      console.error("Login error:", error);
      // Jika terjadi error di database
      Swal.fire({
        title: "Question!",
        text: "Terjadi kesalahan di database. Silakan coba lagi.",
        icon: "question",
        confirmButtonText: "OK",
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Kiri - Gambar */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="flex-1/3 flex flex-col items-center justify-center p-10 bg-gradient-to-r from-violet-400 to-purple-300 relative"
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
          />
        </motion.div>
      </motion.div>

      {/* Kanan - Form Login */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="flex-1 flex flex-col justify-center items-center p-10"
      >
        <div className="w-full max-w-md p-8">
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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading}
            />
            <motion.input
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.8 }}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.8 }}
              className="flex items-center justify-between text-sm"
            >
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="text-purple-500" />
                <span>Remember me</span>
              </label>
              <a href="#" className="text-purple-500">
                Forgot password?
              </a>
            </motion.div>
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.8 }}
              type="submit"
              className="w-full py-2 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:ring-purple-800"
              disabled={loading}
            >
              {loading ? "Loading..." : "Log In"}
            </motion.button>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7, duration: 0.8 }}
              className="text-center mt-4"
            >
              <span className="text-gray-600">New here? </span>
              <Link href="/register" className="text-purple-500">
                Create an account
              </Link>
            </motion.div>
          </form>
        </div>
        <div className="bottom-0 absolute flex flex-row pb-8 justify-center items-center gap-2">
          <p className="opacity-80">Raka - Made with</p>
          <GoHeartFill color="magenta" />
        </div>
      </motion.div>
    </div>
  );
}
