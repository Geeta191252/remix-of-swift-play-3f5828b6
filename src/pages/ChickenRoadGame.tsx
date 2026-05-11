import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Volume2, VolumeX, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  playBetSound,
  playWinSound,
  playLoseSound,
  playResultReveal,
  startBgMusic,
  stopBgMusic,
} from "@/hooks/useGameSounds";
import { useBalanceContext } from "@/contexts/BalanceContext";
import { reportGameResult } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";

type Difficulty = "easy" | "medium" | "hard" | "hardcore";
type Phase = "betting" | "playing" | "lost" | "cashed";

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { multipliers: number[]; crashBase: number; label: string; color: string }
> = {
  easy: {
    multipliers: [1.05, 1.15, 1.30, 1.48, 1.70, 1.95, 2.25, 2.60],
    crashBase: 0.07,
    label: "Easy",
    color: "hsl(140 70% 50%)",
  },
  medium: {
    multipliers: [1.20, 1.45, 1.78, 2.20, 2.75, 3.45, 4.35, 5.50],
    crashBase: 0.15,
    label: "Medium",
    color: "hsl(45 90% 55%)",
  },
  hard: {
    multipliers: [1.50, 2.10, 3.00, 4.30, 6.20, 9.00, 13.0, 19.0],
    crashBase: 0.26,
    label: "Hard",
    color: "hsl(25 90% 55%)",
  },
  hardcore: {
    multipliers: [2.00, 4.00, 8.00, 16.0, 32.0, 64.0, 128, 256],
    crashBase: 0.45,
    label: "Hardcore",
    color: "hsl(0 80% 55%)",
  },
};

const BET_PRESETS = [0.5, 1, 2, 7];
const LANE_COUNT = 8;

const ChickenRoadGame = () => {
  const navigate = useNavigate();
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  const { dollarBalance, starBalance, dollarWinning, starWinning, refreshBalance } =
    useBalanceContext();
  const [localDollarAdj, setLocalDollarAdj] = useState(0);
  const [localStarAdj, setLocalStarAdj] = useState(0);
  const gameDollarBalance = dollarBalance + dollarWinning + localDollarAdj;
  const gameStarBalance = starBalance + starWinning + localStarAdj;

  const [activeWallet, setActiveWallet] = useState<"dollar" | "star">("dollar");
  const [selectedBet, setSelectedBet] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [phase, setPhase] = useState<Phase>("betting");
  const [currentLane, setCurrentLane] = useState(0); // 0 = on chicken sidewalk; 1..N = crossed N lanes
  const [carLane, setCarLane] = useState<number | null>(null); // lane that has incoming car for crash animation
  const [winAmount, setWinAmount] = useState(0);
  const [round, setRound] = useState(1);

  useEffect(() => {
    if (soundOn) startBgMusic();
    else stopBgMusic();
    return () => {
      stopBgMusic();
    };
  }, [soundOn]);

  const cfg = DIFFICULTY_CONFIG[difficulty];
  const currentBalance = activeWallet === "dollar" ? gameDollarBalance : gameStarBalance;
  const currentMultiplier = currentLane > 0 ? cfg.multipliers[currentLane - 1] : 0;
  const nextMultiplier =
    currentLane < LANE_COUNT ? cfg.multipliers[currentLane] : cfg.multipliers[LANE_COUNT - 1];

  const startGame = useCallback(() => {
    if (currentBalance < selectedBet) {
      toast({
        title: "Insufficient balance",
        description: `Need ${activeWallet === "dollar" ? "$" : ""}${selectedBet}${
          activeWallet === "star" ? " ⭐" : ""
        } to play`,
        variant: "destructive",
      });
      return;
    }
    if (activeWallet === "dollar") setLocalDollarAdj((p) => p - selectedBet);
    else setLocalStarAdj((p) => p - selectedBet);
    if (soundRef.current) playBetSound();

    setCurrentLane(0);
    setCarLane(null);
    setWinAmount(0);
    setPhase("playing");
  }, [currentBalance, selectedBet, activeWallet]);

  const goNext = useCallback(() => {
    if (phase !== "playing") return;
    if (currentLane >= LANE_COUNT) return;

    // Rigged crash probability — boost early lanes a bit, lessen at the end
    const stepIndex = currentLane; // 0..LANE_COUNT-1
    const earlyBoost = stepIndex < 2 ? 1.25 : 1.0;
    const lateScale = stepIndex >= LANE_COUNT - 2 ? 1.4 : 1.0;
    const hitProb = Math.min(0.9, cfg.crashBase * earlyBoost * lateScale);

    const isHit = Math.random() < hitProb;

    if (isHit) {
      setCarLane(stepIndex + 1);
      setPhase("lost");
      if (soundRef.current) playLoseSound();
      setRound((r) => r + 1);
      reportGameResult({
        betAmount: selectedBet,
        winAmount: 0,
        currency: activeWallet,
        game: "chickenroad",
      })
        .then(() => {
          setLocalDollarAdj(0);
          setLocalStarAdj(0);
          refreshBalance();
        })
        .catch(console.error);
      return;
    }

    const newLane = currentLane + 1;
    setCurrentLane(newLane);
    if (soundRef.current) playResultReveal();

    // Auto-win on final lane
    if (newLane >= LANE_COUNT) {
      const mult = cfg.multipliers[LANE_COUNT - 1];
      const prize = Math.floor(selectedBet * mult * 100) / 100;
      setWinAmount(prize);
      setPhase("cashed");
      if (soundRef.current) playWinSound();
      setRound((r) => r + 1);
      reportGameResult({
        betAmount: selectedBet,
        winAmount: prize,
        currency: activeWallet,
        game: "chickenroad",
      })
        .then(() => {
          setLocalDollarAdj(0);
          setLocalStarAdj(0);
          refreshBalance();
        })
        .catch(console.error);
    }
  }, [phase, currentLane, cfg, selectedBet, activeWallet, refreshBalance]);

  const cashOut = useCallback(() => {
    if (phase !== "playing" || currentLane === 0) return;
    const mult = cfg.multipliers[currentLane - 1];
    const prize = Math.floor(selectedBet * mult * 100) / 100;
    setWinAmount(prize);
    setPhase("cashed");
    if (soundRef.current) playWinSound();
    setRound((r) => r + 1);
    reportGameResult({
      betAmount: selectedBet,
      winAmount: prize,
      currency: activeWallet,
      game: "chickenroad",
    })
      .then(() => {
        setLocalDollarAdj(0);
        setLocalStarAdj(0);
        refreshBalance();
      })
      .catch(console.error);
  }, [phase, currentLane, cfg, selectedBet, activeWallet, refreshBalance]);

  const resetToBet = () => {
    setPhase("betting");
    setCurrentLane(0);
    setCarLane(null);
    setWinAmount(0);
  };

  const cur = activeWallet === "dollar" ? "$" : "⭐";
  const fmt = (n: number) =>
    activeWallet === "dollar" ? `$${n.toFixed(2)}` : `${n.toFixed(2)} ⭐`;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          "linear-gradient(180deg, hsl(265 55% 12%) 0%, hsl(255 50% 6%) 100%)",
      }}
    >
      {/* Top Bar */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: "hsla(260, 50%, 18%, 0.9)" }}
      >
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate("/")}
            className="h-9 w-9 rounded-lg border-2 flex items-center justify-center"
            style={{
              borderColor: "hsla(260, 40%, 50%, 0.5)",
              background: "hsla(260, 40%, 30%, 0.5)",
            }}
          >
            <Home className="h-4 w-4" style={{ color: "hsl(260, 20%, 90%)" }} />
          </button>
          <button
            onClick={() => setSoundOn((p) => !p)}
            className="h-9 w-9 rounded-lg border-2 flex items-center justify-center"
            style={{
              borderColor: "hsla(260, 40%, 50%, 0.5)",
              background: "hsla(260, 40%, 30%, 0.5)",
            }}
          >
            {soundOn ? (
              <Volume2 className="h-4 w-4" style={{ color: "hsl(260, 20%, 90%)" }} />
            ) : (
              <VolumeX className="h-4 w-4" style={{ color: "hsl(260, 20%, 90%)" }} />
            )}
          </button>
        </div>
        <h1
          className="text-lg font-black tracking-wider"
          style={{
            background:
              "linear-gradient(135deg, hsl(45 95% 65%), hsl(25 90% 55%), hsl(0 80% 55%))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 10px hsla(25, 90%, 55%, 0.6))",
          }}
        >
          🐔 CHICKEN ROAD
        </h1>
        <div
          className="rounded-lg px-2.5 py-1 flex items-center gap-1.5"
          style={{
            background: "hsla(140, 60%, 40%, 0.2)",
            border: "1px solid hsla(140, 70%, 50%, 0.4)",
            boxShadow: "0 0 12px hsla(140, 70%, 50%, 0.3)",
          }}
        >
          <span className="text-xs">{cur}</span>
          <span
            className="text-xs font-bold"
            style={{ color: "hsl(140 80% 75%)" }}
          >
            {currentBalance.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Live wins ticker */}
      <div
        className="px-3 py-1.5 flex items-center gap-3 overflow-hidden text-[10px]"
        style={{ background: "hsla(260, 40%, 12%, 0.95)" }}
      >
        <span className="flex items-center gap-1 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full inline-block animate-pulse" style={{ background: "hsl(140 70% 55%)" }} />
          <span style={{ color: "hsl(140 60% 70%)" }}>Live wins</span>
        </span>
        <span style={{ color: "hsl(260 25% 65%)" }}>
          Online: <span style={{ color: "hsl(45 80% 65%)" }} className="font-bold">33,386</span>
        </span>
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <motion.div
            animate={{ x: ["100%", "-100%"] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="flex gap-6 inline-block"
          >
            {["Blush +$160.00", "LuckyMike +$98.50", "QueenB +$75.20", "JohnnyX +$52.00", "MaxPwr +$230.00"].map(
              (t, i) => (
                <span key={i} style={{ color: "hsl(140 70% 70%)" }}>
                  ⭐ {t}
                </span>
              )
            )}
          </motion.div>
        </div>
      </div>

      {/* PLAY AREA - horizontal road */}
      <div className="relative flex-1 overflow-hidden" style={{ background: "hsl(0 0% 18%)" }}>
        {/* Lane dividers (vertical dashed lines) */}
        <div className="absolute inset-0 flex">
          {/* sidewalk on left */}
          <div
            className="shrink-0"
            style={{
              width: "16%",
              background:
                "repeating-linear-gradient(45deg, hsl(0 0% 22%) 0 8px, hsl(0 0% 18%) 8px 16px)",
              borderRight: "3px solid hsl(45 80% 50%)",
            }}
          />
          {Array.from({ length: LANE_COUNT }).map((_, i) => (
            <div
              key={i}
              className="flex-1 relative"
              style={{
                borderRight:
                  i < LANE_COUNT - 1
                    ? "2px dashed hsla(0, 0%, 100%, 0.5)"
                    : "none",
              }}
            />
          ))}
        </div>

        {/* Lane content overlay */}
        <div className="relative h-full flex">
          {/* Chicken sidewalk */}
          <div
            className="shrink-0 flex items-center justify-center"
            style={{ width: "16%" }}
          >
            <AnimatePresence>
              {currentLane === 0 && phase !== "lost" && (
                <motion.div
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1, y: [0, -4, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ y: { duration: 1, repeat: Infinity } }}
                  className="text-5xl drop-shadow-lg"
                  style={{ filter: "drop-shadow(0 4px 8px hsla(0,0%,0%,0.6))" }}
                >
                  🐔
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Lanes */}
          {cfg.multipliers.map((mult, i) => {
            const laneNumber = i + 1;
            const isCrossed = currentLane >= laneNumber;
            const isCurrent = currentLane === laneNumber && phase === "playing";
            const isCrashLane = carLane === laneNumber;
            const isNextLane = currentLane === laneNumber - 1 && phase === "playing";

            return (
              <div
                key={i}
                className="flex-1 relative flex flex-col items-center justify-center"
              >
                {/* Car coming down (crash animation) */}
                <AnimatePresence>
                  {isCrashLane && (
                    <motion.div
                      initial={{ y: "-110%" }}
                      animate={{ y: "30%" }}
                      transition={{ duration: 0.5, ease: "easeIn" }}
                      className="absolute top-0 text-4xl"
                      style={{ filter: "drop-shadow(0 0 10px hsla(0,80%,50%,0.8))" }}
                    >
                      🚛
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chicken on this lane */}
                {currentLane === laneNumber && phase === "playing" && (
                  <motion.div
                    layoutId="chicken"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1, y: [0, -3, 0] }}
                    transition={{
                      y: { duration: 0.8, repeat: Infinity },
                      scale: { type: "spring", stiffness: 200 },
                    }}
                    className="absolute text-5xl z-10"
                    style={{ filter: "drop-shadow(0 4px 8px hsla(0,0%,0%,0.6))" }}
                  >
                    🐔
                  </motion.div>
                )}

                {/* Crashed chicken */}
                {currentLane === laneNumber - 1 && phase === "lost" && carLane === laneNumber && (
                  <motion.div
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.3, 0], rotate: [0, 20, -20, 360] }}
                    transition={{ duration: 0.8 }}
                    className="absolute text-5xl z-10"
                  >
                    💥
                  </motion.div>
                )}

                {/* Multiplier disc */}
                <motion.div
                  animate={
                    isNextLane
                      ? {
                          scale: [1, 1.08, 1],
                          boxShadow: [
                            `0 0 12px ${cfg.color}66`,
                            `0 0 24px ${cfg.color}cc`,
                            `0 0 12px ${cfg.color}66`,
                          ],
                        }
                      : {}
                  }
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="rounded-full flex items-center justify-center font-bold text-white relative"
                  style={{
                    width: "85%",
                    aspectRatio: "1",
                    maxWidth: 60,
                    background: isCrossed
                      ? "radial-gradient(circle, hsl(140 70% 35%) 0%, hsl(140 60% 22%) 100%)"
                      : "radial-gradient(circle, hsl(0 0% 35%) 0%, hsl(0 0% 18%) 100%)",
                    border: isCrossed
                      ? "2px solid hsl(140 80% 60%)"
                      : "2px solid hsl(0 0% 45%)",
                    fontSize: "0.75rem",
                    boxShadow: isCrossed
                      ? "0 0 12px hsla(140, 70%, 50%, 0.6)"
                      : "inset 0 -3px 4px hsla(0,0%,0%,0.4)",
                  }}
                >
                  {isCrossed ? (
                    <span style={{ color: "hsl(140 90% 80%)" }}>✓</span>
                  ) : (
                    <span style={{ fontSize: mult >= 100 ? "0.55rem" : mult >= 10 ? "0.65rem" : "0.7rem" }}>
                      {mult >= 100 ? mult.toFixed(0) : mult.toFixed(2)}x
                    </span>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* Live multiplier overlay */}
        {phase === "playing" && currentLane > 0 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, hsl(140 70% 45%), hsl(160 60% 40%))",
              color: "white",
              boxShadow: "0 0 20px hsla(140, 70%, 50%, 0.6)",
              border: "1.5px solid hsl(140 90% 65%)",
            }}
          >
            WIN! {fmt(selectedBet * currentMultiplier)}
          </motion.div>
        )}

        {/* Lost overlay */}
        {phase === "lost" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, hsl(0 80% 50%), hsl(20 75% 45%))",
              color: "white",
              boxShadow: "0 0 20px hsla(0, 80%, 50%, 0.6)",
            }}
          >
            💥 SHOT DOWN!
          </motion.div>
        )}

        {/* Cashed overlay */}
        {phase === "cashed" && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, hsl(45 90% 50%), hsl(25 85% 50%))",
              color: "white",
              boxShadow: "0 0 20px hsla(45, 90%, 55%, 0.7)",
            }}
          >
            🏆 CASHED OUT {fmt(winAmount)}
          </motion.div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-3 py-3 grid grid-cols-2 gap-3" style={{ background: "hsla(260, 40%, 12%, 0.95)" }}>
        {phase === "playing" ? (
          <>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={cashOut}
              disabled={currentLane === 0}
              className="py-3.5 rounded-2xl font-black text-base relative"
              style={{
                background:
                  currentLane > 0
                    ? "linear-gradient(135deg, hsl(45 95% 55%), hsl(35 90% 48%))"
                    : "hsla(0, 0%, 30%, 0.5)",
                color: currentLane > 0 ? "hsl(0 0% 15%)" : "hsl(0 0% 50%)",
                boxShadow:
                  currentLane > 0
                    ? "0 4px 18px hsla(45, 90%, 50%, 0.5), inset 0 -3px 6px hsla(25, 85%, 30%, 0.5)"
                    : "none",
                border: currentLane > 0 ? "2px solid hsl(45 95% 70%)" : "2px solid transparent",
              }}
            >
              <div className="text-[11px] leading-tight">CASH OUT</div>
              <div className="text-base leading-tight">
                {currentLane > 0 ? fmt(selectedBet * currentMultiplier) : "—"}
              </div>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={goNext}
              className="py-3.5 rounded-2xl font-black text-lg"
              style={{
                background: "linear-gradient(135deg, hsl(140 75% 45%), hsl(150 70% 38%))",
                color: "white",
                boxShadow:
                  "0 4px 18px hsla(140, 70%, 45%, 0.5), inset 0 -3px 6px hsla(150, 70%, 25%, 0.5)",
                border: "2px solid hsl(140 85% 60%)",
              }}
            >
              GO →
              <div className="text-[10px] font-bold opacity-80 leading-tight">
                next: {nextMultiplier.toFixed(2)}x
              </div>
            </motion.button>
          </>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={phase === "betting" ? startGame : resetToBet}
            className="col-span-2 py-3.5 rounded-2xl font-black text-lg"
            style={{
              background: "linear-gradient(135deg, hsl(140 75% 45%), hsl(150 70% 38%))",
              color: "white",
              boxShadow:
                "0 4px 18px hsla(140, 70%, 45%, 0.5), inset 0 -3px 6px hsla(150, 70%, 25%, 0.5)",
              border: "2px solid hsl(140 85% 60%)",
            }}
          >
            {phase === "betting" ? `▶ START — ${fmt(selectedBet)}` : "🔄 PLAY AGAIN"}
          </motion.button>
        )}
      </div>

      {/* Difficulty + Bet controls (only in betting) */}
      {(phase === "betting" || phase === "lost" || phase === "cashed") && (
        <div className="px-3 pb-4 space-y-2" style={{ background: "hsla(260, 40%, 12%, 0.95)" }}>
          {/* Difficulty */}
          <div>
            <p className="text-[11px] font-bold mb-1.5 px-1" style={{ color: "hsl(260 30% 70%)" }}>
              Difficulty
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => {
                const active = difficulty === d;
                const c = DIFFICULTY_CONFIG[d].color;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className="rounded-xl py-2 text-[11px] font-black transition-all"
                    style={{
                      background: active
                        ? `linear-gradient(135deg, ${c}, ${c})`
                        : "hsla(260, 30%, 22%, 0.8)",
                      color: active ? "white" : "hsl(260 30% 75%)",
                      border: active ? `1.5px solid ${c}` : "1.5px solid hsla(260, 30%, 35%, 0.5)",
                      boxShadow: active ? `0 0 12px ${c}80` : "none",
                    }}
                  >
                    {DIFFICULTY_CONFIG[d].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bet amount */}
          <div
            className="rounded-2xl p-2"
            style={{ background: "hsla(260, 30%, 18%, 0.9)" }}
          >
            <div
              className="flex items-center justify-between rounded-xl overflow-hidden"
              style={{ background: "hsla(260, 30%, 28%, 0.8)" }}
            >
              <button
                onClick={() => setSelectedBet((prev) => Math.max(0.5, +(prev - 1).toFixed(2)))}
                className="w-12 h-11 flex items-center justify-center text-2xl font-bold"
                style={{ color: "hsl(0 0% 80%)" }}
              >
                −
              </button>
              <div className="flex-1 text-center">
                <span className="text-lg font-bold" style={{ color: "hsl(45 95% 65%)" }}>
                  {fmt(selectedBet)}
                </span>
              </div>
              <button
                onClick={() => setSelectedBet((prev) => +(prev + 1).toFixed(2))}
                className="w-12 h-11 flex items-center justify-center text-2xl font-bold"
                style={{ color: "hsl(0 0% 80%)" }}
              >
                +
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {BET_PRESETS.map((bet) => (
                <button
                  key={bet}
                  onClick={() => setSelectedBet((prev) => +(prev + bet).toFixed(2))}
                  className="rounded-xl py-2 text-xs font-bold transition-all"
                  style={{
                    background: "hsla(260, 30%, 28%, 0.8)",
                    color: "hsl(260 30% 80%)",
                    border: "1px solid hsla(260, 30%, 40%, 0.5)",
                  }}
                >
                  +{activeWallet === "dollar" ? `$${bet}` : `${bet} ⭐`}
                </button>
              ))}
            </div>
          </div>

          {/* Wallet toggle */}
          <div className="flex gap-2 items-center">
            <div
              className="flex-1 rounded-full px-3 py-2 flex items-center justify-center gap-2"
              style={{
                background: "hsla(260, 30%, 18%, 0.9)",
                border: `2px solid ${activeWallet === "star" ? "hsl(45 90% 55%)" : "hsl(140 70% 50%)"}`,
              }}
            >
              {activeWallet === "star" ? (
                <>
                  <span className="text-[10px] font-semibold" style={{ color: "hsl(260 30% 65%)" }}>
                    Stars
                  </span>
                  <span className="text-sm">⭐</span>
                  <span className="font-bold text-sm" style={{ color: "hsl(45 90% 70%)" }}>
                    {gameStarBalance.toLocaleString()}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-semibold" style={{ color: "hsl(260 30% 65%)" }}>
                    Balance
                  </span>
                  <span className="text-sm">💲</span>
                  <span className="font-bold text-sm" style={{ color: "hsl(140 80% 75%)" }}>
                    {gameDollarBalance.toFixed(2)}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={() =>
                setActiveWallet((prev) => (prev === "dollar" ? "star" : "dollar"))
              }
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90"
              style={{
                background: "hsla(260, 30%, 28%, 0.9)",
                border: "2px solid hsl(45 80% 55%)",
              }}
            >
              <span className="text-xs">🔄</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChickenRoadGame;
