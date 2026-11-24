// Single source of truth for portfolio content. Used by the build (Astro page),
// the Notion fetch script, and the Notion setup script. Never shipped to the client.
import { z } from "zod";

const ym = z
  .string()
  .regex(/^(\d{4}(-\d{2})?|present)?$/, 'use "YYYY-MM", "YYYY" or "present"');

const url = z
  .string()
  .regex(/^(https?:\/\/|mailto:|tel:|\/)/, "must start with https://, mailto:, tel: or /");

export const CategorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "lowercase slug (a-z, 0-9, -)"),
  label: z.string().min(1),
  shortLabel: z.string().max(14).optional(),
  icon: z.string().min(1),
  order: z.number(),
  visible: z.boolean(),
});

export const LinkSchema = z.object({ label: z.string().min(1), url });

export const ItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "lowercase slug (a-z, 0-9, -)"),
  categoryId: z.string().min(1),
  title: z.string().min(1),
  org: z.string().optional(),
  shortLabel: z.string().max(14).optional(),
  icon: z.string().optional(),
  location: z.string().optional(),
  start: ym.optional(),
  end: ym.optional(),
  summary: z.string().optional(),
  bullets: z.array(z.string()),
  tags: z.array(z.string()),
  links: z.array(LinkSchema),
  logo: z.string().optional(),
  logoDomain: z.string().optional(),
  meter: z.object({ label: z.string(), value: z.number().min(0).max(1) }).optional(),
  order: z.number(),
  visible: z.boolean(),
});

export const ProfileSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  tagline: z.string(),
  about: z.string().optional(),
  location: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  resumePdf: z.string().optional(),
});

export const ContentSchema = z.object({
  profile: ProfileSchema,
  categories: z.array(CategorySchema),
  items: z.array(ItemSchema),
});

export type Category = z.infer<typeof CategorySchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Content = z.infer<typeof ContentSchema>;

/** Throws a readable error naming the row and column of the first problems. */
export function validateContent(raw: unknown, source: string, columns: Record<string, Record<string, string>> = {}): Content {
  const res = ContentSchema.safeParse(raw);
  if (res.success) return res.data;
  const data = raw as Record<string, unknown[]>;
  const lines = res.error.issues.slice(0, 20).map((iss) => {
    const [table, row, col] = iss.path;
    const rec = typeof row === "number" ? (data?.[table as string]?.[row] as { id?: string; title?: string }) : undefined;
    const name = rec ? ` (row ${Number(row) + 1}: "${rec.title ?? rec.id ?? "?"}")` : "";
    const field = String(col ?? row ?? "");
    return `  - ${String(table)}${name} → column "${columns[String(table)]?.[field] ?? field}": ${iss.message}`;
  });
  throw new Error(`Invalid content from ${source}:\n${lines.join("\n")}`);
}
