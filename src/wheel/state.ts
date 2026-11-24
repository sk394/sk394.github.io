// Level stack + History API routing. URL shape: #/<category>[/<subcategory>][/<item>][?page=N]
import type { WheelNode } from "./types.ts";

export const MAX_WEDGES = 8;
const PAGE = MAX_WEDGES - 1;

export type Route = { path: string[]; page: number };

export type View = {
  route: Route;
  ring: WheelNode;          // node whose children form the visible ring
  wedges: WheelNode[];      // visible wedges (paged, incl. "More")
  pages: number;
  selected?: WheelNode;     // item/about whose detail is open
  selectedIndex: number;    // wedge index of the selection (or of the ring in its parent)
  depth: number;            // 0 = root ring
};

export function parseHash(hash: string): Route {
  const h = decodeURIComponent(hash.replace(/^#\/?/, ""));
  const [p, q] = h.split("?");
  const path = p.split("/").filter(Boolean);
  const page = Math.max(0, Number(new URLSearchParams(q).get("page") || 1) - 1) || 0;
  return { path, page };
}

export function toHash(r: Route): string {
  const p = r.path.map(encodeURIComponent).join("/");
  return `#/${p}${r.page ? `?page=${r.page + 1}` : ""}`;
}

export function pageWedges(node: WheelNode, page: number): { wedges: WheelNode[]; pages: number; page: number } {
  const kids = node.children ?? [];
  if (kids.length <= MAX_WEDGES) return { wedges: kids, pages: 1, page: 0 };
  const pages = Math.ceil(kids.length / PAGE);
  const p = ((page % pages) + pages) % pages;
  const more: WheelNode = {
    id: "__more", kind: "more", label: "More", short: "More ›", icon: "more",
    sub: `Page ${((p + 1) % pages) + 1} of ${pages} next`,
  };
  return { wedges: [...kids.slice(p * PAGE, p * PAGE + PAGE), more], pages, page: p };
}

/** Resolve a route against the tree, normalising anything that does not exist. */
export function resolve(root: WheelNode, r: Route): View {
  let ring = root;
  let selected: WheelNode | undefined;
  const path: string[] = [];
  let depth = 0;
  for (const id of r.path) {
    const child = ring.children?.find((c) => c.id === id);
    if (!child || child.kind === "post") break; // posts are pages of their own, not wheel states
    path.push(id);
    if (child.children?.length && child.kind === "group") {
      ring = child;
      depth++;
    } else {
      selected = child;
      break;
    }
  }
  let page = r.page;
  if (selected) {
    const idx = ring.children!.indexOf(selected);
    if ((ring.children?.length ?? 0) > MAX_WEDGES) page = Math.floor(idx / PAGE);
  }
  const pw = pageWedges(ring, page);
  const selectedIndex = selected ? pw.wedges.indexOf(selected) : -1;
  return { route: { path, page: pw.page }, ring, wedges: pw.wedges, pages: pw.pages, selected, selectedIndex, depth };
}

export function parentRoute(v: View): Route | null {
  if (v.selected) return { path: v.route.path.slice(0, -1), page: v.route.page };
  if (v.depth === 0) return null;
  return { path: v.route.path.slice(0, -1), page: 0 };
}

type Listener = (v: View, prev: View | null) => void;

export class Router {
  view: View;
  private listeners: Listener[] = [];

  constructor(private root: WheelNode) {
    this.view = resolve(root, parseHash(location.hash));
    addEventListener("popstate", () => this.sync());
  }

  on(fn: Listener) {
    this.listeners.push(fn);
  }

  private emit(prev: View | null) {
    for (const fn of this.listeners) fn(this.view, prev);
  }

  private sync() {
    const prev = this.view;
    this.view = resolve(this.root, parseHash(location.hash));
    if (toHash(prev.route) !== toHash(this.view.route) || prev.selected !== this.view.selected) this.emit(prev);
  }

  go(r: Route, replace = false) {
    const next = resolve(this.root, r);
    const hash = toHash(next.route);
    const cur = location.hash || "#/";
    if (hash === cur && next.selected === this.view.selected) return;
    if (replace) history.replaceState(history.state, "", hash);
    else history.pushState({ from: cur }, "", hash);
    const prev = this.view;
    this.view = next;
    this.emit(prev);
  }

  /** Returns false when already at the root (caller may close the wheel). */
  back(): boolean {
    const target = parentRoute(this.view);
    if (!target) return false;
    const hash = toHash(resolve(this.root, target).route);
    if (history.state?.from === hash || (history.state?.from === "#/" && hash === "#/")) history.back();
    else this.go(target, true);
    return true;
  }
}
