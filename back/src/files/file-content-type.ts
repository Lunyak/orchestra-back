/** MIME по расширению файла (для раздачи audio/image/video/model). */
export function contentTypeForExtension(ext: string): string {
  switch (String(ext ?? '').toLowerCase()) {
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    case '.m4a':
      return 'audio/mp4';
    case '.flac':
      return 'audio/flac';
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.mkv':
      return 'video/x-matroska';
    case '.avi':
      return 'video/x-msvideo';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.glb':
      return 'model/gltf-binary';
    case '.gltf':
      return 'model/gltf+json';
    default:
      return 'application/octet-stream';
  }
}

export function contentTypeForFileName(fileName: string): string {
  const ext = fileName.slice(fileName.lastIndexOf('.')) || '';
  return contentTypeForExtension(ext);
}
