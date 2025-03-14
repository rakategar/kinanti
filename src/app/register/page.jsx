"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function Register() {
  const [formData, setFormData] = useState({
    nama: "",
    phone: "",
    password: "",
    kelas: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };
  const router = useRouter();
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // ✅ Validasi Nomor WhatsApp
    if (!/^628\d{8,12}$/.test(formData.phone)) {
      setError("❌ Nomor WhatsApp harus diawali 628 dan memiliki 10-14 digit.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Terjadi kesalahan.");

      // ✅ Langsung login setelah registrasi
      const loginRes = await signIn("credentials", {
        phone: formData.phone,
        password: formData.password,
        redirect: false, // Supaya kita bisa menangani navigasi manual
      });

      if (loginRes.error) throw new Error(loginRes.error);

      // ✅ Redirect ke dashboard setelah login
      router.replace("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ backgroundColor: "#ECF2FA" }}
    >
      {/* Logo */}
      <div className="absolute top-10 left-10">
        <Image
          src="/logo.svg"
          alt="Forwardin Logo"
          width={177}
          height={33.63}
        />
      </div>

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
            Kinanti - Solusi Cerdas untuk Manajemen Tugas dan Pesan Otomatis
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

        <form className="flex flex-col gap-[20px]" onSubmit={handleSubmit}>
          <div className="relative">
            <input
              type="text"
              id="nama"
              placeholder="Nama Lengkap"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 placeholder-opacity-50 text-black"
              value={formData.nama}
              onChange={handleChange}
            />
          </div>

          <div className="relative">
            <select
              id="kelas"
              value={formData.kelas}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500  placeholder-gray-500 placeholder-opacity-50 text-black"
            >
              <option value="" disabled>
                Pilih Kelas
              </option>
              <option value="XTKJ1">X TKJ 1</option>
              <option value="XTKJ2">X TKJ 2</option>
              <option value="XITKJ1">XI TKJ 1</option>
              <option value="XITKJ2">XI TKJ 2</option>
              <option value="XIITKJ1">XII TKJ 1</option>
              <option value="XIITKJ2">XII TKJ 2</option>
            </select>
          </div>

          <div className="relative flex gap-2">
            <input
              type="text"
              id="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="WhatsApp Number 62895xxxxxxxx"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 placeholder-opacity-50 text-black"
            />
          </div>

          <div className="relative">
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 placeholder-opacity-50 text-black"
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
            disabled={loading}
          >
            {loading ? "Loading" : "Register"}
          </button>

          {/* Error Massage */}
          {error && (
            <p className="bg-red-500 rounded-lg flex justify-center items-center p-2">
              {error}
            </p>
          )}

          <div className="text-center mt-4">
            <a className="text-sm text-black pr-2">Sudah punya akun?</a>
            <a href="/login" className="text-sm text-blue-500">
              Masuk di sini
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
