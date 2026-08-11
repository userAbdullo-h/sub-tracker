import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <div className="signin-wrap">
      <div className="signin-card">
        <div className="logo signin-logo">💳</div>
        <h1>PayPilot</h1>
        <p>Your subscriptions, purchases and API usage, on autopilot.</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn-primary">
            Sign in with Google
          </button>
        </form>
        <p className="signin-note">Access is restricted to the owner&apos;s account.</p>
      </div>
    </div>
  );
}
