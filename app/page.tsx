"use client";
import { useStore } from "@/lib/store";
import { Shell } from "@/components/ui";
import type { ScreenId } from "@/lib/types";
import Home from "@/components/screens/Home";
import BringText from "@/components/screens/BringText";
import Photograph from "@/components/screens/Photograph";
import Record from "@/components/screens/Record";
import Catch from "@/components/screens/Catch";
import SlipMap from "@/components/screens/SlipMap";
import ShareCard from "@/components/screens/ShareCard";
import Private from "@/components/screens/Private";
import Settings from "@/components/screens/Settings";
import ModelLoad from "@/components/screens/ModelLoad";
import Listening from "@/components/screens/Listening";

const SCREENS: Record<ScreenId, React.ComponentType> = {
  s0: Home,
  s1: BringText,
  s2: Photograph,
  s3: Record,
  s4: Catch,
  s5: SlipMap,
  s6: ShareCard,
  s7: Private,
  s8: Settings,
  modelload: ModelLoad,
  listening: Listening,
};

export default function Page() {
  const { screen } = useStore();
  const Active = SCREENS[screen] ?? Home;
  return (
    <Shell>
      <Active />
    </Shell>
  );
}
