"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

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

    try {
      const res = await signIn("credentials", {
        phone,
        password,
        redirect: false,
      });

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      router.replace("/");
    } catch (error) {
      console.error("Login error:", error);
      setError("Terjadi kesalahan saat login.");
      setLoading(false);
    }
  };
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ backgroundColor: "#ECF2FA" }}
    >
      {/* Logo */}
      <Link className="absolute top-10 left-10" href={"/"}>
        <Image
          src="/logo.svg"
          alt="Forwardin Logo"
          width={177}
          height={33.63}
        />
      </Link>

      {/* Content Section */}
      <div className="w-[465px] mr-28">
        {/* <div className="w-[465px] h-[292.36px] rounded-tl-lg overflow-hidden">
          <Image
            src="/gambarlogin.svg"
            alt="Admin Tools Screenshot"
            width={465}
            height={292.36}
            className="rounded-tl-lg"
          />
        </div> */}
        <div className="mt-[45px] text-left">
          <h1 className="text-2xl font-bold text-gray-800">
            Kinanti - Solusi Cerdas untuk Manajemen Tugas dan Pesan Otomatis{" "}
          </h1>
          <p className="mt-[30px] text-gray-600">
            Kinantiku dirancang untuk mempermudah guru, siswa, dan pelaku bisnis
            dalam mengelola informasi dengan cepat dan praktis. Tingkatkan
            produktivitas Anda dengan solusi yang simpel, aman, dan mudah
            digunakan! 🚀
          </p>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="w-[466px] flex flex-col justify-center p-[40px] bg-white rounded-lg shadow-md">
        <div className="text-center mb-[40px]">
          <h2 className="text-2xl font-bold text-black">
            Selamat Datang di Kinanti Ku !
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Tingkatkan Produktifitas, Gapai Prestasi <br />
            Bersama Kinanti !
          </p>
        </div>
        <form className="flex flex-col gap-[30px]" onSubmit={handleSubmit}>
          <div className="relative">
            <input
              type="text"
              placeholder="62xxxxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 placeholder-opacity-50 text-black"
              disabled={loading} // Nonaktifkan input jika loading
            />
          </div>
          <div className="relative">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 placeholder-opacity-50 text-black"
              disabled={loading} // Nonaktifkan input jika loading
            />
          </div>
          <div className="flex items-center justify-between">
            <a href="#" className="text-sm text-blue-500">
              Lupa Password?
            </a>
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading} // Nonaktifkan tombol jika loading
          >
            {loading ? "Loading..." : "Sign In"}
          </button>
          <div className="text-center mt-4 ">
            <a className="text-sm text-black pr-2">Butuh buat akun?</a>
            <a href="/register" className="text-sm text-blue-500">
              Daftar di sini
            </a>
          </div>
        </form>
        {/* Error Message */}
        {error && (
          <p className="bg-red-500 rounded-lg flex justify-center items-center p-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
