"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    /* eslint-disable no-console */
    console.error(
      "应用错误:",
      error instanceof Error ? error.message : JSON.stringify(error),
    );
  }, [error]);

  // 提取错误消息
  const errorMessage = error instanceof Error ? error.message : "未知错误";

  return (
    <div className="p-4 border border-red-300 rounded bg-red-50 my-4 mx-auto max-w-lg">
      <h2 className="text-xl font-bold text-red-700 mb-2">出错了！</h2>
      <p className="text-red-600 mb-4">{errorMessage}</p>
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        重试
      </button>
    </div>
  );
}
