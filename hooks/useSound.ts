import { useRef, useCallback } from "react";

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

type OscillatorType = "square" | "sine" | "sawtooth" | "triangle";

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabled = useRef(true);

  const getCtx = (): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  };

  const tone = useCallback(
    (
      freq: number,
      duration: number,
      type: OscillatorType = "square",
      gain = 0.25,
      delay = 0
    ) => {
      if (!enabled.current) return;
      try {
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
        gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration + 0.05);
      } catch {
        // silently ignore
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    toggleSound: () => {
      enabled.current = !enabled.current;
    },
    playMove: useCallback(() => {
      tone(440, 0.08, "square", 0.2);
    }, [tone]),
    playCapture: useCallback(() => {
      tone(300, 0.07, "square", 0.25);
      tone(200, 0.12, "square", 0.2, 0.07);
    }, [tone]),
    playCheck: useCallback(() => {
      tone(550, 0.12, "sine", 0.3);
      tone(440, 0.12, "sine", 0.25, 0.15);
    }, [tone]),
    playCastle: useCallback(() => {
      tone(500, 0.08, "square", 0.2);
      tone(600, 0.08, "square", 0.2, 0.1);
    }, [tone]),
    playGameOver: useCallback(() => {
      [300, 260, 220, 196].forEach((f, i) => tone(f, 0.3, "sine", 0.3, i * 0.22));
    }, [tone]),
    playError: useCallback(() => {
      tone(180, 0.15, "sawtooth", 0.2);
    }, [tone]),
  };
}
