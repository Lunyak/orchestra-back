declare module "@capacitor/core" {
  export const Capacitor: {
    isNativePlatform(): boolean;
    getPlatform(): string;
    convertFileSrc(path: string): string;
  };
}

declare module "@capacitor/network" {
  export type NetworkStatus = { connected: boolean };
  export const Network: {
    getStatus(): Promise<NetworkStatus>;
    addListener(
      event: string,
      handler: (status: NetworkStatus) => void,
    ): Promise<{ remove: () => void }>;
  };
}

declare module "@capacitor/filesystem" {
  export const Directory: { Data: string };
  export const Encoding: { UTF8: string };
  export const Filesystem: {
    readFile(opts: unknown): Promise<{ data: string }>;
    writeFile(opts: unknown): Promise<void>;
    stat(opts: unknown): Promise<unknown>;
    mkdir(opts: unknown): Promise<void>;
    getUri(opts: unknown): Promise<{ uri: string }>;
  };
}
