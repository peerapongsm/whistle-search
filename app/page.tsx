import Link from "next/link";
import WhistleSearchApp from "@/components/WhistleSearchApp";

export default function HomePage() {
  return (
    <>
      <header className="app-header">
        <h1>ผิวปาก Search 🎐</h1>
        <p>UI ด้วยเสียงผิวปาก เพราะทำได้ — ผิวปากทำนอง แล้วให้เว็บทายว่าเพลงอะไร</p>
        <div className="nav-buttons">
          <Link href="/method/" className="btn btn-outline">
            ทำงานยังไง?
          </Link>
        </div>
      </header>
      <main>
        <WhistleSearchApp />
      </main>
      <footer className="app-footer">
        <p>ผิวปาก Search · ไม่ใช่การค้นเว็บจริง · pitch detection ล้วนทำงานในเบราว์เซอร์</p>
      </footer>
    </>
  );
}
