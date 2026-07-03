import type { Metadata } from "next";
import { Space_Mono, Bai_Jamjuree } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

const baiJamjuree = Bai_Jamjuree({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ผิวปาก Search",
  description: "ผิวปากทำนอง แล้วเว็บทายว่าเพลงอะไร — pitch detection ล้วนทำงานในเบราว์เซอร์ ไม่มีการอัดหรือส่งเสียงไปไหน",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${spaceMono.variable} ${baiJamjuree.variable}`}>
      <head>
        <script
          defer
          src="https://umami-host-peerapongsms-projects.vercel.app/script.js"
          data-website-id="3f09453d-0b39-443e-8845-5e65611cc58a"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
