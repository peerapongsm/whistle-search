import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ผิวปาก Search",
  description: "ผิวปากทำนอง แล้วเว็บทายว่าเพลงอะไร — pitch detection ล้วนทำงานในเบราว์เซอร์ ไม่มีการอัดหรือส่งเสียงไปไหน",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
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
