import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <main className="authPage">
      <section className="authCard">
        <Link href="/login" className="backLink">← Sign in</Link>
        <p className="eyebrow">Account recovery</p>
        <h1>Reset password</h1>
        <p>Enter the email address connected to your account.</p>
        {message && <p className="authMessage" role="status">{message}</p>}
        <form className="authForm" action={requestPasswordReset}>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button className="primaryButton">Send reset link</button>
        </form>
      </section>
    </main>
  );
}
