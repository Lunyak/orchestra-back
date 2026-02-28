export interface PlaylistTrack {
  id: number;
  title: string;
  file: string;
  fadeMs?: number;
  loop?: boolean;
  /** URL на сервере (MinIO), если трек уже выгружен */
  remoteUrl?: string;
  /** Ключ в хранилище — для запроса свежей ссылки, когда remoteUrl истёк */
  remoteKey?: string;
}

