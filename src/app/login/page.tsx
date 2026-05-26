import { signInAction } from "./actions";

type SearchParams = Promise<{ error?: string }>;

const ERROR_MESSAGES: Record<string, string> = {
  credentials: "Invalid email or password.",
  unauthorized: "That account isn't authorised for AshBets.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;
  const message = error ? ERROR_MESSAGES[error] ?? "Sign-in failed." : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">AshBets</h1>
          <p className="text-sm text-gray-500">Betting Intelligence</p>
        </div>

        {message && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300"
          >
            {message}
          </div>
        )}

        <form action={signInAction} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            Sign in
          </button>
        </form>

        <p className="text-xs text-center text-gray-400">
          Single-user access. Provision your user in Supabase → Authentication → Users.
        </p>
      </div>
    </div>
  );
}
