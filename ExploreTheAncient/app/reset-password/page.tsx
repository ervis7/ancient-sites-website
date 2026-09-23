import { redirect } from "next/navigation";
import { updatePassword } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?error=Open a valid password reset link first.");
  const { error } = await searchParams;

  return (
    <main className="authPage">
      <section className="authCard">
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password</h1>
        {error && <p className="authError" role="alert">{error}</p>}
        <form className="authForm" action={updatePassword}>
          <label>
            New password
            <input name="password" type="password" autoComplete="new-password"
              minLength={8} required />
          </label>
          <label>
            Confirm new password
            <input name="confirmPassword" type="password" autoComplete="new-password"
              minLength={8} required />
          </label>
          <button className="primaryButton">Update password</button>
        </form>
      </section>
    </main>
  );
}
