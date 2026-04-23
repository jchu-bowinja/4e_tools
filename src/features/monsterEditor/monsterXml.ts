export interface MonsterSummary {
  name: string;
  level: string;
  role: string;
  parseError: string | null;
}

const XML_HEADER = '<?xml version="1.0" encoding="utf-8"?>';

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function parseError(doc: Document): string | null {
  const parserError = doc.querySelector("parsererror");
  return parserError ? parserError.textContent?.trim() ?? "Invalid XML." : null;
}

function findDirectChild(root: Element, tagName: string): Element | null {
  for (const child of Array.from(root.children)) {
    if (child.tagName === tagName) {
      return child;
    }
  }
  return null;
}

function getDirectChildText(root: Element, tagName: string): string {
  return findDirectChild(root, tagName)?.textContent?.trim() ?? "";
}

export function summarizeMonsterXml(xml: string, fallbackName: string): MonsterSummary {
  const doc = parseXml(xml);
  const error = parseError(doc);
  if (error) {
    return {
      name: fallbackName,
      level: "",
      role: "",
      parseError: error
    };
  }
  const root = doc.documentElement;
  return {
    name: getDirectChildText(root, "Name") || fallbackName,
    level: getDirectChildText(root, "Level"),
    role: getDirectChildText(root, "Role"),
    parseError: null
  };
}

function upsertDirectChild(doc: Document, tagName: string, value: string): void {
  const root = doc.documentElement;
  let target = findDirectChild(root, tagName);
  if (!target) {
    target = doc.createElement(tagName);
    root.appendChild(target);
  }
  target.textContent = value.trim();
}

function serializeXml(doc: Document): string {
  const serialized = new XMLSerializer().serializeToString(doc);
  if (serialized.startsWith("<?xml")) {
    return serialized;
  }
  return `${XML_HEADER}\n${serialized}`;
}

export function updateMonsterXmlField(xml: string, field: "Name" | "Level" | "Role", value: string): string {
  const doc = parseXml(xml);
  upsertDirectChild(doc, field, value);
  return serializeXml(doc);
}

export function createMonsterTemplate(name = "New Monster"): string {
  const safeName = name.trim() || "New Monster";
  return `${XML_HEADER}
<Monster xsi:type="Monster" xmlns:loader="http://www.wizards.com/listloader" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Name>${safeName}</Name>
  <Level>1</Level>
  <Role>Skirmisher</Role>
</Monster>
`;
}
