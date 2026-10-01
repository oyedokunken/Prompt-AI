// Copies text to the clipboard and reports whether it worked. The modern API
// can be refused, for example in an embedded view without clipboard
// permission, so this falls back to the older selection based copy, and the
// caller finds out honestly instead of getting an unhandled rejection.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through to the fallback
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
