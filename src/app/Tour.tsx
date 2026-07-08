"use client";

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

export interface TourStep {
  /** data-tour 属性の値（ターゲット要素を指定） */
  target: string;
  title: string;
  body: ReactNode;
  /** 吹き出しの位置（ターゲットに対する相対） */
  placement?: "top" | "bottom" | "left" | "right";
}

const STORAGE_PREFIX = "vlog-tour-done:";

const STEPS: TourStep[] = [
  {
    target: "stamp-btn",
    title: "動画へのスタンプ 👍🔥🎉❤️",
    body: "「今日の更新」の各動画にあるスタンプをポチッと押して応援！気に入った動画に即座に反応できます。もう一度押せば取り消せるトグル式。1日1回まで（毎日リセット）。ログイン不要で誰でも押せます。",
    placement: "bottom",
  },
  {
    target: "streak-counter",
    title: "連続更新カウンター 🔥",
    body: "各メンバーが「毎日Vlog」を何日連続で投稿できているかの記録。2026年以降の連続更新日数で、24時間ごとに自動更新されます。数字が大きいほど凄い！",
    placement: "bottom",
  },
  {
    target: "today-updates",
    title: "今日の更新 ✨",
    body: "その日に投稿された最新の動画がここにまとめて表示されます。毎日チェックして見逃しを防ぎましょう。",
    placement: "bottom",
  },
  {
    target: "watched-bar",
    title: "視聴済みバー 📺",
    body: "全体の何本見たかが一眼でわかる進捗バー。動画をクリックすると視聴済みになり、グレーアウトします。ログインすれば端末間で同期されます。",
    placement: "bottom",
  },
  {
    target: "bluesky-login",
    title: "Blueskyログイン 🦋",
    body: (
      <>
        ログインすると視聴済みが端末間で同期されたり、もっと便利な機能が使えるようになります。
        まだ登録してない人は
        <a
          href="https://bsky.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 underline"
        >
          bsky.app
        </a>
        からどうぞ！
      </>
    ),
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

// ステップごとの完了フラグを読む（記録があればスキップ対象）
function isStepDone(target: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + target) === "1";
  } catch {
    return false;
  }
}

// 記録のないステップだけを抽出（初回表示対象）
function getPendingSteps(): TourStep[] {
  return STEPS.filter((s) => !isStepDone(s.target));
}

interface Coords {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function Tour() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<TourStep[]>([]);
  const [step, setStep] = useState(0);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // 初回アクセス判定（記録のないステップがあれば表示）
  useEffect(() => {
    try {
      const p = getPendingSteps();
      if (p.length > 0) {
        setPending(p);
        setOpen(true);
      }
    } catch {
      // localStorage が使えない環境では表示しない
    }
  }, []);

  const currentStep = pending[step];

  // ターゲット要素の位置を計算（fixed基準でそのまま rect を使う）
  const measure = useCallback(() => {
    const id = currentStep?.target;
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
  }, [currentStep]);

  useLayoutEffect(() => {
    if (!open || !currentStep) return;
    // 1. 現在の座標を計測
    measure();
    // 2. ターゲットを画面中央にスクロール（即時）
    const id = currentStep.target;
    const el = document.querySelector(`[data-tour="${id}"]`);
    if (el) el.scrollIntoView({ block: "center", behavior: "auto" });
    // 3. スクロール後に複数回再計測（rAF×2 + scrollend）
    const raf1 = requestAnimationFrame(() => {
      measure();
      const raf2 = requestAnimationFrame(() => measure());
      const onScrollEnd = () => measure();
      window.addEventListener("scrollend", onScrollEnd, { once: true });
      // fallback: 300ms後にも計測
      setTimeout(() => measure(), 300);
      return () => {
        cancelAnimationFrame(raf2);
        window.removeEventListener("scrollend", onScrollEnd);
      };
    });
    return () => cancelAnimationFrame(raf1);
  }, [open, step, currentStep, measure]);

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
      if (e.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 現在のステップを、チェック状態に応じて保存（次回非表示フラグ）
  function saveCurrentStep() {
    if (!dontShowAgain || !currentStep) return; // チェックなしなら保存しない（毎回表示）
    try {
      localStorage.setItem(STORAGE_PREFIX + currentStep.target, "1");
    } catch {
      // ignore
    }
  }

  // ダイアログを閉じる（チェックが入っていれば保存）
  function closeDialog() {
    saveCurrentStep();
    setOpen(false);
  }

  function next() {
    // 中間ステップでも、そのステップのチェック状態を保存する
    saveCurrentStep();
    if (step < pending.length - 1) {
      setStep(step + 1);
    } else {
      // 最後のステップは保存して閉じる
      closeDialog();
    }
  }

  if (!open || !currentStep) return null;

  // 吹き出し位置（fixed基準、rect をそのまま使う）
  const bubbleStyle: React.CSSProperties = coords
    ? {
        position: "fixed",
        top:
          (currentStep.placement ?? "bottom") === "bottom"
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

  return (
    <>
      {/* オーバーレイ（ターゲット以外を暗く） */}
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={() => closeDialog()}
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
            {currentStep.title}
          </span>
          <span className="text-[10px] text-gray-400">
            {step + 1} / {pending.length}
          </span>
        </div>
        <p className="text-xs text-gray-200 leading-relaxed">{currentStep.body}</p>
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
              onClick={() => closeDialog()}
              className="text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
            >
              スキップ
            </button>
            <button
              onClick={next}
              className="text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {step < pending.length - 1 ? "次へ →" : "始める 🎉"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
