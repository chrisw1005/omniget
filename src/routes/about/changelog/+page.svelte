<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n";
  import {
    getChangelogBody,
    getCurrentVersion,
    fetchChangelog,
  } from "$lib/stores/changelog-store.svelte";

  let body = $derived(getChangelogBody());
  let version = $derived(getCurrentVersion());
  let loading = $state(true);

  onMount(async () => {
    await fetchChangelog();
    loading = false;
  });

  function renderMarkdown(md: string): string {
    return md
      .split("\n")
      .map((line) => {
        if (line.startsWith("### ")) {
          return `<h4>${escapeHtml(line.slice(4))}</h4>`;
        }
        if (line.startsWith("## ")) {
          return `<h3>${escapeHtml(line.slice(3))}</h3>`;
        }
        if (line.startsWith("# ")) {
          return `<h2>${escapeHtml(line.slice(2))}</h2>`;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return `<li>${formatInline(line.slice(2))}</li>`;
        }
        if (line.trim() === "") {
          return "<br />";
        }
        return `<p>${formatInline(line)}</p>`;
      })
      .join("");
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatInline(str: string): string {
    let result = escapeHtml(str);
    result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/`(.+?)`/g, "<code>$1</code>");
    result = result.replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );
    return result;
  }
</script>

<div class="changelog-page">
  {#if version}
    <div class="version-row">
      <span class="version-label">{$t("about.version")}</span>
      <span class="version-value">{version}</span>
    </div>
  {/if}

  {#if loading}
    <div class="loading">
      <span class="spinner"></span>
    </div>
  {:else if body}
    <div class="card">
      <div class="markdown-content">
        {@html renderMarkdown(body)}
      </div>
    </div>
  {:else}
    <div class="card empty-card">
      <p class="empty-text">{$t("changelog.empty")}</p>
    </div>
  {/if}
</div>

<style>
  .changelog-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .version-row {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    align-self: flex-start;
    padding: 4px var(--space-3);
    background: var(--accent-soft);
    border-radius: var(--radius-full);
  }

  .version-label {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .version-value {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-7) 0;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .card {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-5);
  }

  .empty-card {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
  }

  .empty-text {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  .markdown-content {
    font-size: var(--text-sm);
    line-height: 1.7;
    color: var(--text);
  }

  .markdown-content :global(h2) {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 600;
    margin: 0 0 var(--space-2);
    letter-spacing: -0.01em;
  }

  .markdown-content :global(h3) {
    font-size: var(--text-md);
    font-weight: 600;
    margin: var(--space-4) 0 var(--space-2);
  }

  .markdown-content :global(h4) {
    font-size: var(--text-sm);
    font-weight: 600;
    margin: var(--space-3) 0 var(--space-1);
    color: var(--text-muted);
  }

  .markdown-content :global(p) {
    margin: 0 0 4px;
  }

  .markdown-content :global(li) {
    margin: 0 0 4px;
    padding-left: var(--space-2);
    list-style: none;
  }

  .markdown-content :global(li::before) {
    content: "•";
    color: var(--accent);
    margin-right: 6px;
  }

  .markdown-content :global(strong) {
    font-weight: 600;
  }

  .markdown-content :global(code) {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    padding: 1px 5px;
    background: var(--surface-hi);
    border-radius: var(--radius-xs);
  }

  .markdown-content :global(a) {
    color: var(--accent);
    text-decoration: none;
  }

  @media (hover: hover) {
    .markdown-content :global(a:hover) {
      text-decoration: underline;
    }
  }

  .markdown-content :global(br) {
    display: block;
    content: "";
    margin-top: 4px;
  }
</style>
