interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemFileHandle extends FileSystemHandle {
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle {
  values(): AsyncIterable<FileSystemHandle>;
  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker?(options?: {
    mode?: "read" | "readwrite";
  }): Promise<FileSystemDirectoryHandle>;
}
