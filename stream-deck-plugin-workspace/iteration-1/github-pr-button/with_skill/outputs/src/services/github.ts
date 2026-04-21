// src/services/github.ts
// GitHub API client — fetches open PRs assigned to the authenticated user
import streamDeck from "@elgato/streamdeck";

const GITHUB_API_BASE = "https://api.github.com";

interface GlobalSettings {
  clientId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  githubUsername?: string;
}

export interface PullRequest {
  number: number;
  title: string;
  url: string;
  repository: string;
  author: string;
  createdAt: string;
}

export class GitHubService {
  private accessToken: string | null = null;
  private _clientId: string | null = null;
  private expiresAt = 0;
  private _username: string | null = null;

  async loadFromSettings(): Promise<boolean> {
    const s = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    if (!s.clientId) return false;
    this._clientId = s.clientId;
    if (!s.accessToken) return false;
    this.accessToken = s.accessToken;
    this.expiresAt = s.expiresAt ?? Number.MAX_SAFE_INTEGER;
    this._username = s.githubUsername ?? null;
    return true;
  }

  get isAuthorized(): boolean {
    return !!(this.accessToken);
  }

  get clientId(): string | null {
    return this._clientId;
  }

  get username(): string | null {
    return this._username;
  }

  async storeTokens(accessToken: string, refreshToken: string, expiresAt: number): Promise<void> {
    this.accessToken = accessToken;
    this.expiresAt = expiresAt;

    const s = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    await streamDeck.settings.setGlobalSettings<GlobalSettings>({
      ...s,
      accessToken,
      refreshToken,
      expiresAt,
    });

    // Fetch and cache the username
    try {
      const user = await this.getCurrentUser();
      this._username = user.login;
      const updated = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
      await streamDeck.settings.setGlobalSettings<GlobalSettings>({
        ...updated,
        githubUsername: user.login,
      });
    } catch (err) {
      streamDeck.logger.warn(`Failed to fetch GitHub username: ${err}`);
    }
  }

  async storeClientId(clientId: string): Promise<void> {
    this._clientId = clientId;
    const s = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    await streamDeck.settings.setGlobalSettings<GlobalSettings>({
      ...s,
      clientId,
    });
  }

  async clearAuth(): Promise<void> {
    this.accessToken = null;
    this.expiresAt = 0;
    this._username = null;
    const s = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    await streamDeck.settings.setGlobalSettings<GlobalSettings>({
      ...s,
      accessToken: undefined,
      refreshToken: undefined,
      expiresAt: undefined,
      githubUsername: undefined,
    });
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    const res = await fetch(`${GITHUB_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (res.status === 401) {
      // Token is invalid/expired — clear auth
      await this.clearAuth();
      throw new Error("GitHub token expired or revoked — please re-authenticate");
    }

    if (!res.ok) {
      throw new Error(`GitHub API error (${res.status}): ${await res.text()}`);
    }

    return res.json() as Promise<T>;
  }

  private async getCurrentUser(): Promise<{ login: string }> {
    return this.request<{ login: string }>("/user");
  }

  /**
   * Fetch open PRs assigned to the current user using GitHub search API.
   * Query: is:pr is:open assignee:<username> archived:false
   */
  async getOpenAssignedPRs(): Promise<PullRequest[]> {
    if (!this._username) {
      // Try to fetch username first
      try {
        const user = await this.getCurrentUser();
        this._username = user.login;
      } catch {
        throw new Error("Cannot determine GitHub username");
      }
    }

    interface SearchItem {
      number: number;
      title: string;
      html_url: string;
      repository_url: string;
      user: { login: string };
      created_at: string;
    }

    interface SearchResult {
      total_count: number;
      items: SearchItem[];
    }

    const query = `is:pr is:open assignee:${this._username} archived:false`;
    const encoded = encodeURIComponent(query);
    const data = await this.request<SearchResult>(
      `/search/issues?q=${encoded}&per_page=100&sort=updated&order=desc`
    );

    return data.items.map((item) => {
      // Extract repo name from repository_url: https://api.github.com/repos/{owner}/{repo}
      const repoMatch = item.repository_url.match(/\/repos\/(.+)$/);
      const repository = repoMatch ? repoMatch[1] : "unknown";

      return {
        number: item.number,
        title: item.title,
        url: item.html_url,
        repository,
        author: item.user.login,
        createdAt: item.created_at,
      };
    });
  }
}

export const github = new GitHubService();
