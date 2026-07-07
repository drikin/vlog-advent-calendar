"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export interface TourStep {
  /** data-tour 属性の値（ターゲット要素を指定） */
  target: string;
  title: string;
  body: string;
  /** 吹き出しの位置（ターゲットに対する相対） */
  placement?: "top" | "bottom" | "left" | "right";
}

const STORAGE_KEY = "vlog-tour-done";

const STEPS: TourStep[] = [
  {
    target: "stamp-btn",
    title: "応援スタンプ 👍🔥🎉❤️",
    body: "各メンバーのカードにあるスタンプをポチッと押して応援！もう一度押せば取り消せるトグル式。1日1回まで（毎日リセット）。ログイン不要で誰でも押せます。",
    placement: "bottom",
  },
  {
    target: "today-updates",
    title: "今日の更新 ✨",
    body: "その日に投稿された最新の動画がここにまとめて表示されます。毎日チェックして見逃しを防ぎましょう。",
    placement: "bottom",
  },
  {
    target: "month-tabs",
    title: "月タブ 🗓️",
    body: "6月〜12月まで切り替えられます。過去の月の動画も全部見られます。",
    placement: "bottom",
  },
  {
    target: "ranking-btn",
    title: "ランキング 📊",
    body: "スタンプの月間累計や投稿数・連続日数のランキングが見られます。盛り上がりをチェック！",
    placement: "bottom",
  },
];

interface Coords {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function Tour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // 初回アクセス判定
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      // localStorage が使えない環境では表示しない
    }
  }, []);

  // ターゲット要素の位置を計算（fixed基準でそのまま rect を使う）
  const measure = useCallback(() => {
    const id = STEPS[step]?.target;
    if (!id) {
      setCoords(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${id}"]`);
    if (!el) {
      setCoords(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
    // 座標確定後にスクロール（smoothではなく即時でズレ防止）
    el.scrollIntoView({ block: "center" });
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    // レイアウト確定後に計測、さらに rAF で再計測（scroll後の補正）
    measure();
    const raf = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(raf);
  }, [open, step, measure]);

  // リサイズ時も再計測
  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, measure]);

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // save=true のときだけ localStorage に保存（次回非表示）
  function close(save: boolean) {
    setOpen(false);
    if (save) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
    }
  }

  function finish() {
    // チェックが入ってなければ次回も表示（保存しない）
    close(!dontShowAgain);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  }

  if (!open) return null;

  // 吹き出し位置（fixed基準、rect をそのまま使う）
  const bubbleStyle: React.CSSProperties = coords
    ? {
        position: "fixed",
        top:
          (STEPS[step].placement ?? "bottom") === "bottom"
            ? Math.min(coords.top + coords.height + 12, window.innerHeight - 160)
            : Math.max(12, coords.top - 140),
        left: Math.min(
          Math.max(12, coords.left + coords.width / 2 - 160),
          window.innerWidth - 332
        ),
        width: 320,
        zIndex: 60,
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 320,
        zIndex: 60,
      };

  const current = STEPS[step];

  return (
    <>
      {/* オーバーレイ（ターゲット以外を暗く） */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={() => close(false)}
        aria-hidden
      />
      {/* ハイライト枠 */}
      {coords && (
        <div
          className="fixed rounded-lg ring-2 ring-amber-400 pointer-events-none z-50"
          style={{
            top: coords.top - 4,
            left: coords.left - 4,
            width: coords.width + 8,
            height: coords.height + 8,
          }}
        />
      )}
      {/* 吹き出し */}
      <div
        style={bubbleStyle}
        className="bg-gradient-to-br from-purple-900/95 to-pink-900/95 border border-purple-500/50 rounded-xl p-4 shadow-2xl shadow-purple-900/40 text-white"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-purple-200">
            {current.title}
          </span>
          <span className="text-[10px] text-gray-400">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        <p className="text-xs text-gray-200 leading-relaxed">{current.body}</p>
        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="accent-purple-500 w-3.5 h-3.5"
            />
            次回から表示しない
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => close(false)}
              className="text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
            >
              スキップ
            </button>
            <button
              onClick={next}
              className="text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {step < STEPS.length - 1 ? "次へ →" : "始める 🎉"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
