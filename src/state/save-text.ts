import { Share } from 'react-native';

/**
 * Hands a text to the person. On Android and iOS it goes through the share sheet of the phone,
 * from where it can be saved or sent; in the browser (`save-text.web.ts`) it is a download.
 */
export async function saveText(filename: string, text: string): Promise<void> {
  await Share.share({ title: filename, message: text });
}
