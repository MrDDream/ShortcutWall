// Translations the server embeds in the page for client-side messages.

export const clientTranslations = readClientTranslations();

export function readClientTranslations() {
  try {
    const node = document.getElementById('app-translations');
    return node ? JSON.parse(node.textContent) : {};
  } catch {
    return {};
  }
}
