"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { GoHeartFill } from "react-icons/go";
import Swal from "sweetalert2";

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
      Swal.fire({
        title: "Warning!",
        text: "Nomor HP harus diawali dengan 62.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      setLoading(false);
      return;
    }

    // Tampilkan SweetAlert2 untuk konfirmasi data
    const { isConfirmed } = await Swal.fire({
      title: "Konfirmasi Data",
      html: `
        <div class="text-left">
          <p><strong>Nama:</strong> ${formData.nama}</p>
          <p><strong>Kelas:</strong> ${formData.kelas}</p>
          <p><strong>Nomor WhatsApp:</strong> ${formData.phone}</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Daftar",
      cancelButtonText: "Batal",
      confirmButtonColor: "#7e22ce", // Warna ungu
      cancelButtonColor: "#6b7280", // Warna abu-abu
    });

    // Jika pengguna memilih "Batal", hentikan proses
    if (!isConfirmed) {
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

      // Tampilkan SweetAlert2 untuk notifikasi sukses
      await Swal.fire({
        title: "Sukses!",
        text: "Registrasi berhasil. Anda akan diarahkan ke halaman utama.",
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#7e22ce", // Warna ungu
      });

      // ✅ Redirect ke dashboard setelah login
      router.replace("/");
    } catch (err) {
      setError(err.message);
      // Tampilkan SweetAlert2 untuk notifikasi error
      Swal.fire({
        title: "Error!",
        text: err.message,
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#7e22ce", // Warna ungu
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Kiri - Gambar (Hanya tampil di desktop) */}
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
            src="/gambarRegister.png"
            alt="Register Illustration"
            width={600}
            height={600}
          />
        </motion.div>
      </motion.div>

      {/* Kanan - Form Register (Tampil di semua ukuran layar) */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="flex-1 flex flex-col justify-center items-center p-6 bg-white"
      >
        {/* Logo (Hanya tampil di mobile) */}
        <Link className="md:hidden absolute top-6 left-6" href="/">
          <Image src="/logo.png" alt="Logo" width={120} height={120} />
        </Link>

        {/* Form Register */}
        <div className="w-full max-w-md p-6">
          <motion.h2
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-2xl font-bold text-center text-gray-800"
          >
            Daftar Akun Baru 🚀
          </motion.h2>
          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="text-gray-600 text-center mt-2 w-full"
          >
            Bergabunglah dengan Kinanti untuk meningkatkan produktivitas Anda!
          </motion.p>
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <motion.input
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              type="text"
              id="nama"
              placeholder="Nama Lengkap"
              value={formData.nama}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading}
            />
            <motion.select
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.8 }}
              id="kelas"
              value={formData.kelas}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              <option value="TPTUP">TPTUP</option>
            </motion.select>
            <motion.input
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3, duration: 0.8 }}
              type="text"
              id="phone"
              placeholder="Nomor WhatsApp (628xxxxxxxxxx)"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading}
            />
            <motion.input
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.5, duration: 0.8 }}
              type="password"
              id="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading}
            />
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7, duration: 0.8 }}
              type="submit"
              className="w-full py-2 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              disabled={loading}
            >
              {loading ? "Loading..." : "Daftar"}
            </motion.button>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.9, duration: 0.8 }}
                className="text-red-500 text-center mt-4"
              >
                {error}
              </motion.p>
            )}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.1, duration: 0.8 }}
              className="text-center mt-4"
            >
              <span className="text-gray-600">Sudah punya akun? </span>
              <Link href="/login" className="text-purple-500">
                Masuk di sini
              </Link>
            </motion.div>
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
