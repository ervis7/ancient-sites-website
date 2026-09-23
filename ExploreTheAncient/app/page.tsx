import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <section className="card" aria-labelledby="welcome-heading">
        <p className="eyebrow">Explore The Ancients</p>
        <h1 id="welcome-heading">Explore Greece&apos;s ancient places</h1>
        <p className="homeIntro">
          Build a private collection, record your visits, and keep every place
          tied to your own account.
        </p>
        <div className="homeActions">
          <Link href="/login" className="primaryButton">Sign in</Link>
          <Link href="/signup" className="secondaryButton">Create account</Link>
          <Link href="/browse" className="secondaryButton">Browse locally</Link>
        </div>
      </section>
    </main>
  );
}
