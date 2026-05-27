"use client";

/**
 * Pixel sigil — renders an 8x8 grid from the SIGILS table.
 *
 * Each archetype has an 8x8 character grid where:
 *   . = empty cell    o = ink (foreground)
 *   p = pink accent   g = green accent    d = dim
 *
 * Wrapped in the `.sigil-wrap` / `.sigil` / `.sigil-label` CSS classes
 * from the ported audit-styles.css. The `hideLabel` prop is used when the
 * sigil appears inside the ShowOff CTA, which hides the "№ 0X SIGIL" caption.
 */
import React from "react";
import { ARCHETYPES, SIGILS, type ArchetypeKey } from "@/src/audit/archetypes";

interface Props {
  archetypeKey: ArchetypeKey;
  hideLabel?: boolean;
}

export function Sigil({ archetypeKey, hideLabel }: Props) {
  const grid = SIGILS[archetypeKey] ?? SIGILS.optimist;
  const archetype = ARCHETYPES[archetypeKey];
  const cells: React.ReactElement[] = [];

  for (let y = 0; y < 8; y++) {
    const row = grid[y] ?? "........";
    for (let x = 0; x < 8; x++) {
      const c = row[x] ?? ".";
      let cls = "px";
      if (c === "o") cls += " on";
      else if (c === "p") cls += " p";
      else if (c === "g") cls += " g";
      else if (c === "d") cls += " d";
      cells.push(<div key={`${y}-${x}`} className={cls} />);
    }
  }

  return (
    <div className="sigil-wrap">
      <div className="sigil">{cells}</div>
      {!hideLabel && (
        <div className="sigil-label">
          <span className="ix">№{archetype.index}</span>
          sigil
        </div>
      )}
    </div>
  );
}
