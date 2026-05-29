import { useEffect, useRef } from "react";

interface MoveHistoryProps {
  sanHistory: string[];
}

export default function MoveHistory({ sanHistory }: MoveHistoryProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sanHistory]);

  if (!sanHistory || sanHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-24">
        <p className="text-gray-600 text-sm italic">No moves yet</p>
      </div>
    );
  }

  const pairs: [string, string | null][] = [];
  for (let i = 0; i < sanHistory.length; i += 2) {
    pairs.push([sanHistory[i], sanHistory[i + 1] ?? null]);
  }

  return (
    <div className="overflow-y-auto max-h-64 pr-1">
      <table className="w-full text-sm">
        <tbody>
          {pairs.map(([white, black], idx) => (
            <tr key={idx} className={idx % 2 === 0 ? "bg-dark-700/30" : ""}>
              <td className="py-1 px-2 text-gray-600 w-8 select-none">{idx + 1}.</td>
              <td
                className={`py-1 px-2 font-mono font-medium
                  ${sanHistory.length - 1 === idx * 2 ? "text-accent-blue" : "text-gray-300"}`}
              >
                {white}
              </td>
              <td
                className={`py-1 px-2 font-mono font-medium
                  ${black && sanHistory.length - 1 === idx * 2 + 1 ? "text-accent-blue" : "text-gray-300"}`}
              >
                {black ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div ref={bottomRef} />
    </div>
  );
}
