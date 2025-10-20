"use client";

import { useState } from "react";
import { FiX, FiMessageCircle } from "react-icons/fi";

export default function KinantiBanner({ className = "" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* === BANNER === */}
      <button
        onClick={() => setOpen(true)}
        className={`group flex w-full items-center justify-between rounded-lg border border-violet-200 bg-violet-50/60 hover:bg-violet-100 transition px-5 py-3 my-2 shadow-sm ${className}`}
      >
        <div className="flex items-center gap-4 text-left w-full">
          <div className="flex flex-col justify-center leading-tight w-full">
            <span className="text-violet-700 font-bold text-base md:text-lg tracking-wide">
              Chat dengan Bot Kinanti
            </span>
            <span className="text-[12px] md:text-sm text-gray-600">
              Tap untuk menampilkan QR & chat via WhatsApp
            </span>
          </div>
        </div>

        <span className="flex items-center gap-1 text-violet-600 text-sm md:text-base font-medium group-hover:text-violet-800 ml-3">
          <FiMessageCircle className="text-lg md:text-xl" />
        </span>
      </button>

      {/* === MODAL QR === */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-sm sm:max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-full border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-100 hover:text-black transition"
              aria-label="Tutup"
            >
              <FiX />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                QR Bot Kinanti
              </h3>
            </div>

            <a
              href="https://api.whatsapp.com/send?phone=6285234337767&text=hai%20kinanti%20!"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src="/qr.png"
                alt="QR Chat Bot Kinanti"
                className="mx-auto aspect-square w-full max-w-xs rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:scale-[1.02] transition"
              />
            </a>

            <p className="mt-4 text-center text-sm text-gray-600">
              Klik QR untuk membuka chat langsung dengan bot Kinanti di
              WhatsApp.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
