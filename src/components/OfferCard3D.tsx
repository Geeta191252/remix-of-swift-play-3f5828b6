import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import megaDealImg from "@/assets/offers/mega-deal-dollar.png";
import specialOfferImg from "@/assets/offers/special-offer-star.png";

export interface OfferCard3DData {
  _id: string;
  title?: string;
  payAmount: number;
  payCurrency: "star" | "dollar";
  getAmount: number;
  bonusLabel?: string;
  valueLabel?: string;
}

interface Props {
  offer: OfferCard3DData;
  onClaim: () => void;
  busy?: boolean;
  compact?: boolean;
}

// Parse "+100 ⭐" or "+$10 bonus" → { amount, currency }
const parseBonus = (label?: string): { amount: number; currency: "star" | "dollar" } | null => {
  if (!label) return null;
  const m = label.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const amount = parseFloat(m[1]);
  if (!amount) return null;
  const currency = /\$|dollar/i.test(label) ? "dollar" : "star";
  return { amount, currency };
};

const OfferCard3D = ({ offer, onClaim, busy, compact }: Props) => {
  const isDollar = offer.payCurrency === "dollar";
  const heroImg = isDollar ? megaDealImg : specialOfferImg;
  const bonus = parseBonus(offer.bonusLabel);
  const payDisp = isDollar ? `$${offer.payAmount}` : `${offer.payAmount} ⭐`;
  const getCurrencyIcon = isDollar ? "💵" : "⭐";
  const bonusCurrencyIcon = bonus?.currency === "dollar" ? "💵" : "⭐";

  return (
    <div
      className="rounded-3xl p-1 relative"
      style={{
        background: isDollar
          ? "linear-gradient(135deg, hsl(45 95% 55%), hsl(25 85% 50%), hsl(0 75% 55%))"
          : "linear-gradient(135deg, hsl(280 75% 55%), hsl(310 70% 50%), hsl(45 90% 55%))",
        boxShadow: isDollar
          ? "0 14px 40px hsla(25, 85%, 45%, 0.5)"
          : "0 14px 40px hsla(280, 70%, 45%, 0.5)",
      }}
    >
      <div
        className="rounded-[22px] overflow-hidden relative"
        style={{
          background: isDollar
            ? "linear-gradient(180deg, hsl(260 55% 22%), hsl(270 60% 14%))"
            : "linear-gradient(180deg, hsl(275 55% 25%), hsl(285 60% 16%))",
        }}
      >
        {/* 3D Hero image */}
        <div className="relative w-full" style={{ aspectRatio: compact ? "1.4 / 1" : "1 / 1.05" }}>
          <img
            src={heroImg}
            alt={offer.title || (isDollar ? "Mega Deal" : "Special Offer")}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ filter: "drop-shadow(0 8px 20px hsla(0,0%,0%,0.4))" }}
          />
          {/* Limited time chip */}
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-full" style={{
            background: "hsla(0,0%,0%,0.55)",
            border: "1px solid hsla(45,80%,55%,0.5)",
            backdropFilter: "blur(4px)",
          }}>
            <Clock className="h-3 w-3" style={{ color: "hsl(45 95% 70%)" }} />
            <span className="text-[10px] font-black" style={{ color: "hsl(45 95% 75%)" }}>Limited</span>
          </div>
        </div>

        {/* Amount row */}
        <div className="flex items-center justify-center gap-2 px-3 pt-1 pb-2">
          <div className="flex-1 rounded-2xl py-2.5 text-center" style={{
            background: "hsla(0,0%,0%,0.4)",
            border: "1px solid hsla(0,0%,100%,0.12)",
          }}>
            <div className="text-2xl leading-none mb-0.5">{getCurrencyIcon}</div>
            <div className="font-black text-base leading-tight" style={{ color: "hsl(0 0% 100%)" }}>
              {offer.getAmount.toLocaleString()}
            </div>
          </div>
          {bonus && (
            <>
              <div className="text-2xl font-black" style={{ color: "hsl(45 95% 65%)" }}>+</div>
              <div className="flex-1 rounded-2xl py-2.5 text-center" style={{
                background: "hsla(0,0%,0%,0.4)",
                border: "1px solid hsla(45,80%,55%,0.4)",
              }}>
                <div className="text-2xl leading-none mb-0.5">{bonusCurrencyIcon}</div>
                <div className="font-black text-base leading-tight" style={{ color: "hsl(45 95% 70%)" }}>
                  {bonus.amount.toLocaleString()}
                </div>
              </div>
            </>
          )}
        </div>

        {offer.valueLabel && (
          <div className="text-center pb-1.5">
            <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-black" style={{
              background: "linear-gradient(135deg, hsl(0 80% 55%), hsl(15 80% 50%))",
              color: "hsl(0 0% 100%)",
              textShadow: "1px 1px 0 hsla(0,0%,0%,0.3)",
            }}>
              {offer.valueLabel}
            </span>
          </div>
        )}

        {/* Buy button */}
        <div className="px-4 pb-4 pt-1">
          <motion.button
            whileTap={{ scale: 0.95 }}
            disabled={busy}
            onClick={onClaim}
            className="w-full rounded-2xl py-3 font-black text-base disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, hsl(140 80% 48%), hsl(150 75% 40%))",
              color: "hsl(0 0% 100%)",
              textShadow: "1px 1px 0 hsla(0,0%,0%,0.35)",
              boxShadow: "0 6px 18px hsla(140,70%,40%,0.55), inset 0 -3px 0 hsla(0,0%,0%,0.25), inset 0 2px 0 hsla(0,0%,100%,0.2)",
              border: "2px solid hsl(140 70% 35%)",
            }}
          >
            {busy ? "Processing…" : `Pay ${payDisp}`}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default OfferCard3D;
