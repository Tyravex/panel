/** Read dropped files and nested folders using the browser entry API. */
export async function readDroppedFiles(dataTransfer: DataTransfer): Promise<{ files: File[]; paths?: string[] }> {
    type Entry = {
      isFile: boolean;
      isDirectory: boolean;
      name: string;
      file?: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
      createReader?: () => { readEntries: (success: (entries: Entry[]) => void, error?: (error: DOMException) => void) => void };
    };
    const items = Array.from(dataTransfer.items);
    const roots: Entry[] = items
      .map((item): Entry | null => (item.webkitGetAsEntry?.() ?? null) as Entry | null)
      .filter((entry): entry is Entry => entry !== null);
    if (!roots.length) {
      return { files: Array.from(dataTransfer.files) };
    }
    const files: File[] = [];
    const paths: string[] = [];
    const visit = async (entry: Entry, prefix: string): Promise<void> => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isFile && entry.file) {
        const file = await new Promise<File>((resolve, reject) => entry.file!(resolve, reject));
        files.push(file);
        paths.push(path);
      } else if (entry.isDirectory && entry.createReader) {
        const reader = entry.createReader();
        while (true) {
          const children = await new Promise<Entry[]>((resolve, reject) => reader.readEntries(resolve, reject));
          if (!children.length) break;
          for (const child of children) await visit(child, path);
        }
      }
    };
    for (const root of roots) await visit(root, "");
    return { files, paths };
}
