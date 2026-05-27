"use client";

/**
 * Section 01b — SHOW OFF CTA. Big bordered strip directly after the
 * identity card. Sigil on the left, "show off your agent." headline +
 * sub on the middle, "→ MAKE POSTER" action button on the right.
 *
 * Clicking the action captures the IdentitySection's archetype-frame
 * DOM via html2canvas and triggers a PNG download. The capture target
 * is passed in via a ref (avoids querying the DOM by class).
 */
import React, { useState } from "react";
import { ARCHETYPES, type ArchetypeKey } from "@/src/audit/archetypes";
import { Sigil } from "./sigil";

interface Props {
  archetypeKey: ArchetypeKey;
  /** Ref to the IdentitySection's `.archetype-frame` div — captured to PNG. */
  identityFrameRef: React.RefObject<HTMLDivElement | null>;
}

function buildFilename(archetypeKey: ArchetypeKey): string {
  const date = new Date().toISOString().slice(0, 10);
  return `failproofai-${archetypeKey}-${date}.png`;
}

export function ShowOffCTA({ archetypeKey, identityFrameRef }: Props) {
  const archetype = ARCHETYPES[archetypeKey];
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  const handleMakePoster = async () => {
    const node = identityFrameRef.current;
    if (!node || state === "busy") return;
    setState("busy");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(node, {
        // Match the audit canvas color so any rounding artifacts blend in.
        backgroundColor: "#131316",
        scale: 2, // retina-grade PNG for sharing
        logging: false,
        useCORS: true,
      });
      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = buildFilename(archetypeKey);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        }, "image/png");
      });
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      console.error("poster capture failed:", err);
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  };

  const actionLabel =
    state === "busy" ? "rendering…"
      : state === "done" ? "downloaded ✓"
        : state === "error" ? "render failed"
          : "make poster";

  return (
    <section className="showoff" data-screen-label="01b Show off">
      <button
        type="button"
        className="showoff-cta"
        onClick={handleMakePoster}
        disabled={state === "busy"}
        style={{ cursor: state === "busy" ? "wait" : "pointer", width: "100%", textAlign: "left" }}
      >
        <span className="showoff-glyph" aria-hidden="true">
          <Sigil archetypeKey={archetypeKey} hideLabel />
        </span>
        <span className="showoff-copy">
          <span className="showoff-label">━━ shareable poster</span>
          <span className="showoff-headline">show off your agent.</span>
          <span className="showoff-sub">
            generate a one-page poster of your {archetype.name}.
            score, percentile, sigil. ready to post.
          </span>
        </span>
        <span className="showoff-action">
          <span className="showoff-arrow">→</span>
          <span className="showoff-action-label">{actionLabel}</span>
        </span>
      </button>
    </section>
  );
}
