"use client";
// One-time client bootstrap: install the network ledger, register the offline SW,
// capture the install prompt, and hydrate persisted state. Renders nothing.
import { useEffect } from "react";
import {
  installNetworkLedger,
  subscribeNetwork,
  getNetworkCount,
  getBytesSent,
} from "@/lib/network";
import { registerServiceWorker, captureInstallPrompt } from "@/lib/sw-register";
import { actions } from "@/lib/store";

export function Boot() {
  useEffect(() => {
    // The ledger must be installed before anything can make a request.
    installNetworkLedger();
    const unsubNet = subscribeNetwork(() =>
      actions.setNetwork(getNetworkCount(), getBytesSent())
    );
    registerServiceWorker();
    const unsubInstall = captureInstallPrompt((available) =>
      actions.setInstallAvailable(available)
    );
    void actions.hydrate();
    // deep-link to a screen via ?screen=s4 (handy for sharing a state and for review)
    try {
      const wanted = new URLSearchParams(window.location.search).get("screen");
      // transient states (modelload/listening) are intentionally not deep-linkable — they
      // have no back button and only make sense mid-flow.
      const valid = ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
      if (wanted && valid.includes(wanted)) actions.navigate(wanted as never);
    } catch {
      /* ignore */
    }
    return () => {
      unsubNet();
      unsubInstall();
    };
  }, []);
  return null;
}
