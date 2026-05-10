import {
  Droplets,
  Flame,
  RadioTower,
  Sprout,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { NetKey } from "@/lib/types";

const ICONS: Record<NetKey, LucideIcon> = {
  electric: Zap,
  gas: Flame,
  water: Droplets,
  sewage: Waves,
  telecom: RadioTower,
  irrigation: Sprout,
};

export function NetworkIcon({
  network,
  className = "w-3.5 h-3.5",
}: {
  network: NetKey;
  className?: string;
}) {
  const Icon = ICONS[network];
  return <Icon className={className} strokeWidth={2.1} />;
}
