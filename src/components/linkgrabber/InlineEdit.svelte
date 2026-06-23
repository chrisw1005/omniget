<script lang="ts">
  // Click-to-edit text. Shows as plain text with a hover affordance (edit
  // cursor + outline); clicking turns it into an input. Enter/blur commits,
  // Escape cancels.
  type Props = {
    value: string;
    placeholder?: string;
    onSave: (v: string) => void;
    ariaLabel?: string;
  };

  let { value, placeholder = "", onSave, ariaLabel = "" }: Props = $props();

  let editing = $state(false);
  let draft = $state("");

  function start() {
    draft = value;
    editing = true;
  }

  function commit() {
    if (!editing) return;
    editing = false;
    if (draft !== value) onSave(draft);
  }

  function cancel() {
    editing = false;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  function focusEl(el: HTMLInputElement) {
    el.focus();
    el.select();
  }
</script>

{#if editing}
  <input
    class="inline-input"
    value={draft}
    oninput={(e) => (draft = e.currentTarget.value)}
    onblur={commit}
    onkeydown={onKey}
    onclick={(e) => e.stopPropagation()}
    aria-label={ariaLabel}
    {placeholder}
    spellcheck="false"
    use:focusEl
  />
{:else}
  <button
    type="button"
    class="inline-display"
    class:empty={!value}
    onclick={(e) => { e.stopPropagation(); start(); }}
    title={ariaLabel}
  >
    {value || placeholder}
  </button>
{/if}

<style>
  .inline-display {
    display: inline;
    font: inherit;
    color: inherit;
    text-align: left;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-xs, 6px);
    margin: -2px -6px;
    padding: 2px 6px;
    cursor: text;
    max-width: 100%;
  }

  .inline-display.empty {
    color: var(--text-dim, #636366);
  }

  @media (hover: hover) {
    .inline-display:hover {
      border-color: var(--input-border, #3a3a3c);
      background: var(--input-bg, #1c1c1e);
    }
  }

  .inline-display:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .inline-input {
    font: inherit;
    color: var(--text, #f2f2f7);
    background: var(--input-bg, #1c1c1e);
    border: 1px solid var(--accent);
    border-radius: var(--radius-xs, 6px);
    margin: -3px -7px;
    padding: 2px 6px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .inline-input:focus {
    outline: none;
  }
</style>
