interface ImportMetaEnv {
  readonly BASE_URL: string;
  /** База MinIO/S3 для theater/*: `{S3_PUBLIC_URL}/{S3_BUCKET}` */
  readonly VITE_THEATER_ASSETS_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
