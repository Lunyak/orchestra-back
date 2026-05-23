/** Web/Electron Vite build: Capacitor is only used on native; stub avoids bundling native SDKs. */

export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => "web",
  convertFileSrc: (path: string) => path,
};

export const Network = {
  async getStatus() {
    return { connected: typeof navigator !== "undefined" ? navigator.onLine : true };
  },
  async addListener(_event: string, _handler: (status: { connected: boolean }) => void) {
    return { remove: () => undefined };
  },
};

export const Directory = { Data: "DATA" };
export const Encoding = { UTF8: "utf8" };

export const Filesystem = {
  async readFile() {
    throw new Error("Filesystem unavailable on web stub");
  },
  async writeFile() {
    throw new Error("Filesystem unavailable on web stub");
  },
  async stat() {
    throw new Error("Filesystem unavailable on web stub");
  },
  async mkdir() {
    throw new Error("Filesystem unavailable on web stub");
  },
  async getUri() {
    throw new Error("Filesystem unavailable on web stub");
  },
};
