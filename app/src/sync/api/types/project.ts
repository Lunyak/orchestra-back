export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  updatedAt?: string;
  workspace?: {
    id: string;
    type: "PERSONAL" | "THEATER" | "TROUPE";
    name: string;
  };
}
