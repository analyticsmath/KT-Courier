/**
 * Presentation-only parsing of an immutable published legal document.
 * It does not amend, re-publish, or rewrite the content accepted by a customer.
 */
export type PolicyBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "subheading"; text: string }
  | { kind: "list"; items: string[] };

export type PolicySection = {
  id: string;
  title: string;
  blocks: PolicyBlock[];
};

const SECTION = /^(\d+)\.\s+(.+)$/;
const SUBSECTION = /^(\d+)\.(\d+)\.?\s+(.+)$/;
const BULLET = /^(?:[•●▪◦\-*])\s+(.+)$/u;

/** Internal publication labels are already tracked in the immutable document record. */
function isInternalEditionLabel(line: string): boolean {
  return /^(?:client\s+version|document\s+version)\s*:?\s*(?:v(?:ersion)?\s*)?[\d.]+$/i.test(line)
    || /^version\s*:?\s*(?:v\s*)?\d+(?:\.\d+)*$/i.test(line);
}

export function parsePublishedPolicy(source: string): PolicySection[] {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections: PolicySection[] = [{ id: "overview", title: "Overview", blocks: [] }];
  let current = sections[0];

  for (const line of lines) {
    if (isInternalEditionLabel(line)) continue;

    const subsection = SUBSECTION.exec(line);
    if (subsection) {
      current.blocks.push({ kind: "subheading", text: line });
      continue;
    }

    const section = SECTION.exec(line);
    if (section) {
      current = {
        id: "section-" + section[1] + "-" + sections.length,
        title: section[2],
        blocks: [],
      };
      sections.push(current);
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      const last = current.blocks[current.blocks.length - 1];
      if (last?.kind === "list") last.items.push(bullet[1]);
      else current.blocks.push({ kind: "list", items: [bullet[1]] });
      continue;
    }

    current.blocks.push({ kind: "paragraph", text: line });
  }

  return sections.filter((section) => section.blocks.length > 0);
}
