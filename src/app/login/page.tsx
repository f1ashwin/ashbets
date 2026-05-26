import LoginButton from "./LoginButton";

type SearchParams = Promise<{ error?: string }>;

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "That account isn't authorised for AshBets.",
  oauth: "Sign-in failed. Please try again.",
  callback: "Couldn't complete sign-in. Please try again.",
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
          <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {message}
          </div>
        )}

        <LoginButton />

        <p className="text-xs text-center text-gray-400">
          Single-user access. Sign in with the authorised Google account.
        </p>
      </div>
    </div>
  );
}
