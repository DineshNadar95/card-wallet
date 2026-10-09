import { DISCLAIMER, type EarnRate, rewardsCheckedAt } from "@card-wallet/shared";

/** Rule 4: anything showing card terms shows their source, as-of date and the disclaimer. */
export function SourceNote({ source, rates = [], extra }: { source?: string; rates?: EarnRate[]; extra?: string }) {
  const checked = rewardsCheckedAt(rates);
  return (
    <p className="source-note">
      {source ? `Fees & APRs: ${source}` : "Fees & APRs: CFPB TCCP"} ·{" "}
      {checked ? `Rewards checked ${checked} from issuer pages` : "Reward rates not checked yet"}.
      {extra ? ` ${extra}` : ""} {DISCLAIMER}
    </p>
  );
}
