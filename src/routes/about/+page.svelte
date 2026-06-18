<script lang="ts">
    import { t } from "$lib/i18n";
    import { getVersion } from "@tauri-apps/api/app";
    import { open } from "@tauri-apps/plugin-shell";
    import { BUILD_INFO } from "$lib/build-info";

    const FORK_USER = "chrisw1005";
    const ORIGINAL_AUTHOR = "tonhowtf";
    const LINKS = {
        fork: "https://github.com/chrisw1005/omniget",
        forkProfile: "https://github.com/chrisw1005",
        original: "https://github.com/tonhowtf/omniget",
        originalProfile: "https://github.com/tonhowtf",
        discord: "https://discord.gg/jgdxyPy7Vn",
    };

    let version = $state("");

    $effect(() => {
        getVersion().then((v) => { version = v; }).catch(() => {});
    });

    const buildDetails = $derived(
        [BUILD_INFO.commitShort, BUILD_INFO.branch, BUILD_INFO.date]
            .filter((part) => part && part !== "unknown")
            .join(" · ")
    );

    const cards = [
        { href: "/about/changelog", icon: "changelog", titleKey: "about.card_changelog_title", descKey: "about.card_changelog_desc" },
        { href: "/about/project", icon: "project", titleKey: "about.card_project_title", descKey: "about.card_project_desc" },
        { href: "/about/terms", icon: "terms", titleKey: "about.card_terms_title", descKey: "about.card_terms_desc" },
    ] as const;

    function ext(e: Event, url: string) {
        e.preventDefault();
        open(url).catch(() => {});
    }
</script>

{#snippet cardIcon(kind: string)}
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        {#if kind === "changelog"}
            <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" />
        {:else if kind === "project"}
            <circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" />
        {:else}
            <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 8V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3" /><path d="M9 13h6M9 17h4" />
        {/if}
    </svg>
{/snippet}

<main class="about-overview">
    <header class="about-hero">
        <img src="/favicon.png" alt="OmniGet app icon" class="about-app-icon" width="72" height="72" draggable="false" />
        <div class="about-identity">
            <div class="title-row">
                <h1>OmniGet</h1>
                {#if version}<span class="version-chip">v{version}</span>{/if}
            </div>
            <p class="about-tagline">{$t("about.tagline")}</p>
            <p class="about-desc">{$t("about.description")}</p>
            {#if buildDetails}<span class="about-build">{buildDetails}</span>{/if}
        </div>
    </header>

    <section class="fork-card" aria-label={$t("about.fork_title") as string}>
        <span class="fork-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="6" cy="6" r="2.3" /><circle cx="18" cy="6" r="2.3" /><circle cx="12" cy="18" r="2.3" />
                <path d="M6 8.3v1.2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8.3" /><path d="M12 12.5v3.2" />
            </svg>
        </span>
        <div class="fork-body">
            <span class="fork-badge">{$t("about.fork_title")}</span>
            <p class="fork-desc">{$t("about.fork_desc", { user: FORK_USER, author: ORIGINAL_AUTHOR })}</p>
            <div class="fork-links">
                <a href={LINKS.fork} class="fork-link primary" onclick={(e) => ext(e, LINKS.fork)}>
                    {$t("about.fork_view")}<span aria-hidden="true">→</span>
                </a>
                <a href={LINKS.original} class="fork-link" onclick={(e) => ext(e, LINKS.original)}>
                    {$t("about.original_view")}<span aria-hidden="true">→</span>
                </a>
            </div>
        </div>
    </section>

    <nav class="about-cards" aria-label="OmniGet">
        {#each cards as card}
            <a href={card.href} class="about-card">
                <span class="about-card-icon">{@render cardIcon(card.icon)}</span>
                <span class="about-card-title">{$t(card.titleKey)}</span>
                <span class="about-card-desc">{$t(card.descKey)}</span>
                <span class="about-card-chevron" aria-hidden="true">›</span>
            </a>
        {/each}
    </nav>

    <div class="about-external">
        <a href={LINKS.original} class="about-ext-link" onclick={(e) => ext(e, LINKS.original)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            {$t("about.star_button")}
        </a>
        <a href={LINKS.discord} class="about-ext-link" onclick={(e) => ext(e, LINKS.discord)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18.9 5.3a16.6 16.6 0 0 0-4.1-1.3 12.2 12.2 0 0 0-.5 1.1 15.4 15.4 0 0 0-4.6 0A12.2 12.2 0 0 0 9.2 4a16.6 16.6 0 0 0-4.1 1.3A17.3 17.3 0 0 0 2 17.2a16.7 16.7 0 0 0 5.1 2.6 12.5 12.5 0 0 0 1.1-1.8 10.8 10.8 0 0 1-1.7-.8l.4-.3a11.9 11.9 0 0 0 10.2 0l.4.3a10.8 10.8 0 0 1-1.7.8 12.5 12.5 0 0 0 1.1 1.8 16.7 16.7 0 0 0 5.1-2.6A17.3 17.3 0 0 0 18.9 5.3zM8.7 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" />
            </svg>
            Discord
        </a>
    </div>

    <footer class="about-footer">
        <p class="about-credit">{$t("about.credit")}</p>
        <p class="about-credits-line">
            <a href={LINKS.originalProfile} onclick={(e) => ext(e, LINKS.originalProfile)} title="@{ORIGINAL_AUTHOR}">@{ORIGINAL_AUTHOR}</a>
            <span class="sep" aria-hidden="true">·</span>
            <span class="fork-by">{$t("about.fork_by")}</span>
            <a href={LINKS.forkProfile} onclick={(e) => ext(e, LINKS.forkProfile)} title="@{FORK_USER}">@{FORK_USER}</a>
        </p>
    </footer>
</main>

<style>
    .about-overview {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        max-width: 640px;
    }

    /* ---------- Hero ---------- */
    .about-hero {
        display: flex;
        align-items: flex-start;
        gap: var(--space-4);
    }

    .about-app-icon {
        width: 72px;
        height: 72px;
        border-radius: var(--radius-lg);
        object-fit: cover;
        box-shadow: var(--elev-2, var(--elev-1)), 0 0 0 1px var(--border);
        flex-shrink: 0;
    }

    .about-identity {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
    }

    .title-row {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        flex-wrap: wrap;
    }

    .about-identity h1 {
        font-family: var(--font-display);
        font-size: var(--text-3xl);
        line-height: var(--leading-3xl);
        font-weight: 600;
        letter-spacing: -0.03em;
        margin: 0;
    }

    .version-chip {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
        color: var(--accent);
        background: var(--accent-soft);
        padding: 2px var(--space-2);
        border-radius: var(--radius-full);
        letter-spacing: 0.2px;
    }

    .about-tagline {
        font-size: var(--text-md);
        color: var(--text-muted);
        margin: var(--space-1) 0 0;
        text-wrap: balance;
    }

    .about-desc {
        font-size: var(--text-sm);
        color: var(--text);
        margin: var(--space-1) 0 0;
        max-width: 46ch;
        line-height: 1.55;
        text-wrap: pretty;
    }

    .about-build {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--text-dim);
        opacity: 0.75;
        letter-spacing: 0.3px;
        user-select: all;
        margin-top: var(--space-2);
    }

    /* ---------- Fork card ---------- */
    .fork-card {
        display: flex;
        gap: var(--space-4);
        padding: var(--space-4) var(--space-5);
        border-radius: var(--radius-md);
        background:
            radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 60%),
            var(--surface);
        border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
    }

    .fork-glyph {
        flex-shrink: 0;
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: var(--radius-sm);
        color: var(--accent);
        background: var(--accent-soft);
    }

    .fork-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-width: 0;
    }

    .fork-badge {
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--text);
        letter-spacing: -0.01em;
    }

    .fork-desc {
        font-size: var(--text-sm);
        color: var(--text-muted);
        margin: 0;
        line-height: 1.55;
        text-wrap: pretty;
    }

    .fork-links {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        margin-top: var(--space-1);
    }

    .fork-link {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--text);
        background: var(--surface-hi);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 6px var(--space-3);
        text-decoration: none;
        transition: transform var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out);
    }

    .fork-link.primary {
        color: var(--on-accent, #fff);
        background: var(--accent);
        border-color: transparent;
    }

    .fork-link span {
        transition: transform var(--duration-fast) var(--ease-out);
    }

    @media (hover: hover) {
        .fork-link:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
        .fork-link.primary:hover { filter: brightness(1.06); border-color: transparent; }
        .fork-link:hover span { transform: translateX(2px); }
    }

    .fork-link:active { transform: translateY(1px); }
    .fork-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    /* ---------- Cards ---------- */
    .about-cards {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-3);
    }

    .about-card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-4);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        text-decoration: none;
        color: inherit;
        transition: transform var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out);
    }

    .about-card-icon {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: var(--radius-xs);
        color: var(--accent);
        background: var(--accent-soft);
        margin-bottom: var(--space-1);
    }

    @media (hover: hover) {
        .about-card:hover {
            background: var(--surface-hi);
            border-color: color-mix(in srgb, var(--accent) 25%, var(--border));
            transform: translateY(-1px);
        }
        .about-card:hover .about-card-chevron { transform: translateX(2px); color: var(--accent); }
    }

    .about-card:active { transform: translateY(0); }
    .about-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    .about-card-title {
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--text);
    }

    .about-card-desc {
        font-size: var(--text-xs);
        color: var(--text-muted);
        line-height: 1.45;
        padding-right: var(--space-4);
    }

    .about-card-chevron {
        position: absolute;
        top: var(--space-4);
        right: var(--space-3);
        font-size: 18px;
        color: var(--text-dim);
        line-height: 1;
        transition: transform var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
    }

    /* ---------- External links ---------- */
    .about-external {
        display: flex;
        gap: var(--space-3);
        flex-wrap: wrap;
    }

    .about-ext-link {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-4);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        color: var(--text);
        font-size: var(--text-sm);
        text-decoration: none;
        transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out);
    }

    @media (hover: hover) {
        .about-ext-link:hover {
            background: var(--surface-hi);
            border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
        }
    }

    .about-ext-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    /* ---------- Footer ---------- */
    .about-footer {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding-top: var(--space-3);
        border-top: 1px solid var(--border);
    }

    .about-credit {
        font-size: var(--text-xs);
        color: var(--text-muted);
        margin: 0;
    }

    .about-credits-line {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
        font-size: var(--text-xs);
        color: var(--text-dim);
        margin: 0;
    }

    .about-credits-line a {
        color: var(--text-dim);
        text-decoration: none;
        transition: color var(--duration-fast) var(--ease-out);
    }

    @media (hover: hover) {
        .about-credits-line a:hover { color: var(--accent); }
    }

    .about-credits-line a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
    .about-credits-line .sep { opacity: 0.5; }
    .about-credits-line .fork-by { opacity: 0.85; }

    /* ---------- Responsive ---------- */
    @media (max-width: 520px) {
        .about-cards { grid-template-columns: 1fr; }
        .about-hero { flex-direction: column; align-items: flex-start; }
        .about-desc { max-width: none; }
    }
</style>
