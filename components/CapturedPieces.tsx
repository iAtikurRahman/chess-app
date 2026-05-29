const PIECE_UNICODE: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

const PIECE_ORDER = ["q", "r", "b", "n", "p"];

function sortPieces(types: string[]): string[] {
  return [...types].sort(
    (a, b) => PIECE_ORDER.indexOf(a) - PIECE_ORDER.indexOf(b)
  );
}

interface CapturedPiecesProps {
  pieces: string[];
  capturedFrom: string;
}

export default function CapturedPieces({ pieces, capturedFrom }: CapturedPiecesProps) {
  if (!pieces || pieces.length === 0) {
    return <p className="text-xs text-gray-600 italic">None</p>;
  }

  const sorted = sortPieces(pieces);
  const prefix = capturedFrom === "white" ? "w" : "b";

  return (
    <div className="flex flex-wrap gap-0.5">
      {sorted.map((type, i) => (
        <span key={i} className="text-lg leading-none">
          {PIECE_UNICODE[`${prefix}${type}`] ?? "?"}
        </span>
      ))}
    </div>
  );
}
