import API from '../api/config';

// Uploads a local image (from expo-image-picker) to the backend, which stores it
// on Cloudinary and returns the hosted URL. `folder` is 'team' or 'tournament'
// so crests are organized server-side. Returns the secure URL string.
const uploadService = {
  uploadImage: async (uri, folder, token) => {
    const form = new FormData();
    // React Native FormData file shape: { uri, name, type }.
    const ext = (uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    form.append('image', { uri, name: `logo.${ext}`, type });
    form.append('folder', folder || 'tournament');

    const response = await API.post('/uploads/image', form, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
    return response.data?.data?.url;
  },
};

export default uploadService;
