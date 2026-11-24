export type Detail = {
  title: string;
  org?: string;
  location?: string;
  dates?: string;
  summary?: string;
  bullets: string[];
  tags: string[];
  links: { label: string; url: string }[];
  logo?: string;
};

export type NodeKind = "group" | "item" | "post" | "action" | "about" | "more";

/** One wedge (or the root). Built at compile time by src/content/load.ts. */
export type WheelNode = {
  id: string;
  kind: NodeKind;
  label: string;
  short: string;
  sub?: string;
  icon?: string;
  logo?: string;
  mono?: string;
  href?: string;
  start?: string;
  end?: string;
  count?: number;
  meter?: { label: string; value: number };
  detail?: Detail;
  children?: WheelNode[];
};
