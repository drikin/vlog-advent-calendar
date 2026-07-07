"use client";

import { useEffect, useLayoutEffect, useState } from "react";

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
  const [placement, setPlacement] = useState<TourStep["placement"]>("bottom");

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

  // ターゲット要素の位置を計算
  useLayoutEffect(() => {
    if (!open) return;
    const id = STEPS[step]?.target;
    if (!id) return;
    const el = document.querySelector(`[data-tour="${id}"]`);
    if (!el) {
      setCoords(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const c: Coords = {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    };
    setCoords(c);
    setPlacement(STEPS[step].placement ?? "bottom");
    // ターゲットが画面外ならスクロールして見せる
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [open, step]);

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function finish() {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  }

  if (!open) return null;

  // 吹き出し位置の計算（ターゲットの下 or 上に配置）
  const bubbleStyle: React.CSSProperties = coords
    ? {
        position: "absolute",
        top:
          placement === "bottom"
            ? coords.top + coords.height + 12
            : Math.max(12, coords.top - 120),
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
        onClick={finish}
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
          <button
            onClick={finish}
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
    </>
  );
}
