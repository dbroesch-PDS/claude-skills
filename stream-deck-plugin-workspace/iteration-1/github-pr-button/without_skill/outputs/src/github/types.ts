export interface GlobalSettings {
  clientId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft: boolean;
  repository_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
  };
}

export interface GitHubSearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubPR[];
}
