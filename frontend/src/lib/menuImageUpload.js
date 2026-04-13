export const MAX_MENU_IMAGE_SIZE = 2 * 1024 * 1024;

export const readImageFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) {
    resolve('');
    return;
  }

  if (!file.type.startsWith('image/')) {
    reject(new Error('Please choose an image file.'));
    return;
  }

  if (file.size > MAX_MENU_IMAGE_SIZE) {
    reject(new Error('Please choose an image smaller than 2 MB.'));
    return;
  }

  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Failed to read the selected image.'));
  reader.readAsDataURL(file);
});
