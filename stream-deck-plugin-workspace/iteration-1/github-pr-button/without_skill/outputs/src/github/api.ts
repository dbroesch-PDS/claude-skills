import streamDeck from "@elgato/streamdeck";
import type { GlobalSettings, GitHubSearchResult } from "./types.js";

const BASE = "https://api.github.com";

export class GitHubAPI {
  private accessToken: string | null = null;

  async loadFromSettings(): Promise<boolean> {
    const s = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    if (!s.accessToken) return false;
    this.accessToken = s.accessToken;
    return true;
  }

  get isAuthorized(): boolean {
    return !!this.accessToken;
  }

  private async request<T>(path: string, query?: Record<string, string>): Promise<T> {
    if (!this.accessToken) {
      throw new Error("Not authenticated with GitHub");
    }

    const url = new URL(`${BASE}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (res.status === 401) {
      // Token is invalid — clear it so the UI shows "not connected"
      this.accessToken = null;
      const current = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
      await streamDeck.settings.setGlobalSettings<GlobalSettings>({
        ...current,
        accessToken: undefined,
      });
      throw new Error("GitHub token is invalid or expired. Please re-authenticate.");
    }

    if (res.status === 403) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      if (remaining === "0") {
        const resetAt = Number(res.headers.get("x-ratelimit-reset") ?? 0) * 1000;
        const waitSecs = Math.ceil((resetAt - Date.now()) / 1000);
        throw new Error(`GitHub rate limit exceeded. Resets in ${waitSecs}s.`);
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${path} failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Returns the number of open PRs where the authenticated user is requested as a reviewer.
   * Uses GitHub search: is:open is:pr review-requested:@me
   */
  async getOpenReviewRequestedPRCount(): Promise<number> {
    const result = await this.request<GitHubSearchResult>("/search/issues", {
      q: "is:open is:pr review-requested:@me",
      per_page: "1",
    });
    return result.total_count;
  }

  /**
   * Returns the number of open PRs authored by the authenticated user.
   * Uses GitHub search: is:open is:pr author:@me
   */
  async getOpenAuthoredPRCount(): Promise<number> {
    const result = await this.request<GitHubSearchResult>("/search/issues", {
      q: "is:open is:pr author:@me",
      per_page: "1",
    });
    return result.total_count;
  }

  /**
   * Returns the total count of open PRs for the configured query.
   * mode: "review-requested" | "authored" | "assigned"
   */
  async getPRCount(mode: "review-requested" | "authored" | "assigned"): Promise<number> {
    let q: string;
    switch (mode) {
      case "review-requested":
        q = "is:open is:pr review-requested:@me";
        break;
      case "authored":
        q = "is:open is:pr author:@me";
        break;
      case "assigned":
        q = "is:open is:pr assignee:@me";
        break;
    }

    const result = await this.request<GitHubSearchResult>("/search/issues", {
      q,
      per_page: "1",
    });
    return result.total_count;
  }

  /**
   * Returns the GitHub URL for the PR list for the configured mode.
   */
  static getPRListUrl(mode: "review-requested" | "authored" | "assigned"): string {
    switch (mode) {
      case "review-requested":
        return "https://github.com/pulls?q=is%3Aopen+is%3Apr+review-requested%3A%40me";
      case "authored":
        return "https://github.com/pulls?q=is%3Aopen+is%3Apr+author%3A%40me";
      case "assigned":
        return "https://github.com/pulls?q=is%3Aopen+is%3Apr+assignee%3A%40me";
    }
  }
}

// Singleton used across all actions
export const github = new GitHubAPI();
