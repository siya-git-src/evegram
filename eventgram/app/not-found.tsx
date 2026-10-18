import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap page">
      <div className="empty">
        <h2>Event not found</h2>
        <p>It may have been taken down by the club.</p>
        <Link className="ghost" href="/">Back to the feed</Link>
      </div>
    </main>
  );
}
