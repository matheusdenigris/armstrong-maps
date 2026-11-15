/**
 * Hands a text to the person as a file. In the browser it is a download; on Android and iOS
 * (`save-text.ts`) it goes through the share sheet of the phone.
 */
export async function saveText(filename: string, text: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // The browser has taken the file by the next turn of the loop.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
