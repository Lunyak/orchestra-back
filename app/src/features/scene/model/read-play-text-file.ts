import JSZip from "jszip";

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").trim());
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsText(file, "UTF-8");
  });
}

function extractTextFromWordXml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Не удалось разобрать документ Word");
  }

  const paragraphs = Array.from(doc.getElementsByTagNameNS("*", "p"));
  const lines = paragraphs.map((paragraph) => {
    const runs = Array.from(paragraph.getElementsByTagNameNS("*", "t"));
    return runs.map((node) => node.textContent ?? "").join("");
  });

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function readDocxText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) {
    throw new Error("В файле нет текста документа Word");
  }
  const xml = await entry.async("string");
  const text = extractTextFromWordXml(xml);
  if (!text) throw new Error("В файле не найден текст");
  return text;
}

export async function readPlayTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) {
    const text = await readTextFile(file);
    if (!text) throw new Error("Файл пустой");
    return text;
  }

  if (name.endsWith(".docx")) {
    return readDocxText(file);
  }

  if (name.endsWith(".doc")) {
    throw new Error("Формат .doc не поддерживается. Сохраните файл как .docx или .txt");
  }

  throw new Error("Поддерживаются файлы .txt и .docx");
}
