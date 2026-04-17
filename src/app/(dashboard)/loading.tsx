export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="h-6 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-36 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="h-36 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
