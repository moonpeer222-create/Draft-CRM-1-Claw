/**
 * Copy text to clipboard with fallback for environments where Clipboard API is blocked
 * @param text - The text to copy
 * @returns Promise that resolves when copy is successful
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      // Fall through to fallback method
    }
  }

  // Fallback method using textarea
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) {
        resolve();
      } else {
        reject(new Error('Copy command failed'));
      }
    } catch (err) {
      document.body.removeChild(textarea);
      reject(err);
    }
  });
}
