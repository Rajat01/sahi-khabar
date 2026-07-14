/** Shared between the ingestion pipeline (Node) and the browser check tool. */

export const STOPWORDS = new Set(
  `a an the and or but of in on at to for with by from as is are was were be been
   has have had it its this that these those he she they we you i his her their
   our your not no over after amid says said say new will would could should can
   may might must do does did done up down out off than then so if while about
   into more most other some such only own same too very just also now`
    .split(/\s+/)
    .filter(Boolean),
);

/** Lowercased, de-stopworded, lightly stemmed tokens for similarity math. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9ऀ-ॿ ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t));
}
