import Link from "next/link";
import { redirect } from "next/navigation";
import { signUp } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
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
        <h1>Create account</h1>
        <p>Create a private collection that belongs only to you.</p>

        {params.error && <p className="authError" role="alert">{params.error}</p>}

        <form action={signUp} className="authForm">
          <label>
            Full name
            <input name="fullName" autoComplete="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <div className="authActions">
            <button className="primaryButton">Create account</button>
          </div>
        </form>
        <p className="authSwitch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
