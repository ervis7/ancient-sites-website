import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");

  const params = await searchParams;

  return (
    <main className="authPage">
      <section className="authCard">
        <Link href="/" className="backLink">← Home</Link>
        <p className="eyebrow">Explore The Ancients</p>
        <h1>Sign in</h1>
        <p>Access your private places and personal information.</p>

        {params.error && <p className="authError" role="alert">{params.error}</p>}
        {params.message && <p className="authMessage">{params.message}</p>}

        <form className="authForm">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>
          <div className="authActions">
            <button formAction={signIn} className="primaryButton">Sign in</button>
          </div>
        </form>
        <p className="authSwitch">
          <Link href="/forgot-password">Forgot your password?</Link>
        </p>
        <p className="authSwitch">
          Don&apos;t have an account? <Link href="/signup">Create one</Link>
        </p>
      </section>
    </main>
  );
}
