<script lang="ts">
    import { open } from "@tauri-apps/plugin-shell";
    import { t } from "$lib/i18n";

    const ORIGINAL_AUTHOR = "tonhowtf";
    const FORK_USER = "chrisw1005";
    const LINKS = {
        original: "https://github.com/tonhowtf/omniget",
        fork: "https://github.com/chrisw1005/omniget",
    };

    const FEATURES = [
        "platforms",
        "hotmart",
        "progress",
        "mascot",
        "themes",
        "i18n",
        "tech",
    ] as const;

    function ext(e: Event, url: string) {
        e.preventDefault();
        open(url).catch(() => {});
    }
</script>

<div class="project">
    <header class="project-hero">
        <img src="/loop.png" alt="Loop, the OmniGet mascot" class="project-logo" width="64" height="64" draggable="false" />
        <p class="project-desc">{$t("about.description")}</p>
    </header>

    <section class="feat-card">
        <h2 class="feat-title">{$t("about.features_title")}</h2>
        <ul class="feat-list">
            {#each FEATURES as key}
                <li>
                    <span class="feat-dot" aria-hidden="true"></span>
                    <span>{$t(`about.feature_${key}`)}</span>
                </li>
            {/each}
        </ul>
    </section>

    <footer class="project-credits">
        <a href={LINKS.original} class="credit-repo" onclick={(e) => ext(e, LINKS.original)}>
            <span class="credit-label">{$t("about.original_view")}</span>
            <span class="credit-handle">{ORIGINAL_AUTHOR}/omniget</span>
        </a>
        <a href={LINKS.fork} class="credit-repo" onclick={(e) => ext(e, LINKS.fork)}>
            <span class="credit-label">{$t("about.fork_title")}</span>
            <span class="credit-handle">{FORK_USER}/omniget</span>
        </a>
    </footer>
</div>

<style>
    .project {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
    }

    .project-hero {
        display: flex;
        align-items: center;
        gap: var(--space-4);
    }

    .project-logo {
        width: 64px;
        height: 64px;
        border-radius: var(--radius-lg);
        box-shadow: var(--elev-1);
        flex-shrink: 0;
    }

    .project-desc {
        font-size: var(--text-sm);
        line-height: 1.6;
        color: var(--text-muted);
        margin: 0;
        max-width: 46ch;
        text-wrap: pretty;
    }

    .feat-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: var(--space-5);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
    }

    .feat-title {
        font-size: var(--text-md);
        font-weight: 600;
        color: var(--text);
        letter-spacing: -0.01em;
        margin: 0;
    }

    .feat-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .feat-list li {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        font-size: var(--text-sm);
        line-height: 1.55;
        color: var(--text-muted);
    }

    .feat-dot {
        flex-shrink: 0;
        width: 6px;
        height: 6px;
        margin-top: 1px;
        border-radius: var(--radius-full);
        background: var(--accent);
        transform: translateY(-1px);
    }

    .project-credits {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-3);
    }

    .credit-repo {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--space-3) var(--space-4);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        text-decoration: none;
        transition: border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out);
    }

    @media (hover: hover) {
        .credit-repo:hover {
            background: var(--surface-hi);
            border-color: color-mix(in srgb, var(--accent) 25%, var(--border));
        }
    }

    .credit-repo:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
    }

    .credit-label {
        font-size: var(--text-xs);
        color: var(--text-dim);
    }

    .credit-handle {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--text);
    }

    @media (max-width: 520px) {
        .project-credits {
            grid-template-columns: 1fr;
        }
    }
</style>
