<script>
  import { TOOL } from '../lib/constants.js';
  import ExportButton from './ExportButton.svelte';
  import {
    Footprints,
    Trees,
    Star,
    DoorOpen,
    DoorClosed,
    RefreshCw,
    Route,
    Eraser,
    Wand2
  } from '@lucide/svelte';

  let {
    W = $bindable(),
    H = $bindable(),
    endpointType = $bindable(),
    currentTool = $bindable(),
    setW,
    setH,
    regenerate,
    eraseSolvePath,
    autoSolve
  } = $props();

  const tools = [
    { id: TOOL.PATH,     label: 'Path',     icon: Footprints, activeClass: 'btn-primary'   },
    { id: TOOL.HEDGE,    label: 'Hedge',    icon: Trees,      activeClass: 'btn-primary'   },
    { id: TOOL.ENTRANCE, label: 'Entrance', icon: DoorOpen,   activeClass: 'btn-secondary' },
    { id: TOOL.PLAZA,    label: 'Goal',     icon: Star,       activeClass: 'btn-accent'    },
    { id: TOOL.EXIT,     label: 'Exit',     icon: DoorClosed, activeClass: 'btn-accent'    }
  ];

  // Canvas ref forwarded from CanvasView for the export button.
  let canvasEl = $state(null);

  let sizeUnit = $state('METRES');

  function toggleSizeUnit() {
    sizeUnit = sizeUnit === 'METRES' ? 'YARDS' : 'METRES';
  }
</script>

<aside class="flex flex-col w-full bg-base-200 border-t border-base-300 p-4 gap-5 shrink-0 md:order-first md:h-full md:w-60 md:min-w-52 md:border-t-0 md:border-r md:overflow-y-auto">
  <div>
    <h1 class="text-xl font-bold tracking-tight text-base-content">Hedge & Seek</h1>
    <p class="text-xs text-base-content/60 mt-0.5">Hedge maze builder</p>
  </div>

  <!-- Solve -->
  <section>
    <h2 class="label-text font-semibold mb-2 uppercase text-xs tracking-wider text-base-content/50">Solve</h2>
    <div class="grid grid-cols-3 gap-1 md:grid-cols-2">
      <button
        class="btn btn-sm w-full justify-start gap-2 rounded-sm {currentTool === TOOL.SOLVE ? 'btn-secondary' : 'btn-ghost'}"
        onclick={() => (currentTool = TOOL.SOLVE)}
      >
        <Route size={14} />
        Draw
      </button>
      <button
        class="btn btn-sm w-full justify-start gap-2 rounded-sm btn-ghost"
        onclick={() => autoSolve?.()}
      >
        <Wand2 size={14} />
        Auto
      </button>
      <button
        class="btn btn-sm w-full justify-start gap-2 rounded-sm btn-ghost"
        onclick={() => eraseSolvePath?.()}
      >
        <Eraser size={14} />
        Erase
      </button>
    </div>
  </section>

  <!-- Dimensions -->
  <section class="flex flex-col gap-3">
    <h2 class="label-text font-semibold uppercase text-xs tracking-wider text-base-content/50">
      Size (<button
        type="button"
        class="font-inherit text-inherit"
        onclick={toggleSizeUnit}
        aria-label="Toggle size unit"
      >
        {sizeUnit}
      </button>)
    </h2>

    <div class="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-1">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-base-content/70">Width: <strong>{W}</strong></span>
        <input
          type="range"
          min="11" max="81" step="2"
          value={W}
          class="range range-xs range-primary w-full"
          oninput={(e) => setW(e.target.value)}
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs text-base-content/70">Height: <strong>{H}</strong></span>
        <input
          type="range"
          min="11" max="81" step="2"
          value={H}
          class="range range-xs range-primary w-full"
          oninput={(e) => setH(e.target.value)}
        />
      </label>
    </div>
  </section>

  <!-- Endpoint type -->
  <section>
    <h2 class="label-text font-semibold mb-2 uppercase text-xs tracking-wider text-base-content/50">Objective</h2>
    <div class="join w-full">
      <button
        class="btn btn-sm join-item flex-1 rounded-sm {endpointType === 'goal' ? 'btn-primary' : 'btn-ghost'}"
        onclick={() => (endpointType = 'goal')}
      >
        Goal
      </button>
      <button
        class="btn btn-sm join-item flex-1 rounded-sm {endpointType === 'exit' ? 'btn-primary' : 'btn-ghost'}"
        onclick={() => (endpointType = 'exit')}
      >
        Exit
      </button>
    </div>
  </section>

  <!-- Tool palette -->
  <section>
    <h2 class="label-text font-semibold mb-2 uppercase text-xs tracking-wider text-base-content/50">Design</h2>
    <div class="grid grid-cols-3 gap-1 md:grid-cols-2">
      {#each tools as tool}
        <button
          class="btn btn-sm w-full justify-start gap-2 rounded-sm {currentTool === tool.id ? tool.activeClass : 'btn-ghost'}"
          onclick={() => (currentTool = tool.id)}
        >
          {#snippet icon(IconComp)}<IconComp size={14} />{/snippet}
          {@render icon(tool.icon)}
          {tool.label}
        </button>
      {/each}
    </div>
  </section>

  <!-- Actions -->
  <section class="flex flex-col gap-2 mt-auto">
    <button class="btn btn-sm btn-outline gap-2 w-full rounded-sm" onclick={regenerate}>
      <RefreshCw size={14} />
      Regenerate
    </button>
    <ExportButton />
    <p class="text-xs text-base-content/50 italic text-left mt-1">
      By <a href="https://lewisdryburgh.com" target="_blank" rel="noopener noreferrer" class="link link-hover">Lewis Dryburgh</a>
    </p>
  </section>
</aside>
