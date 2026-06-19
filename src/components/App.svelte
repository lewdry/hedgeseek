<script>
  import { TOOL } from '../lib/constants.js';
  import { generateMaze } from '../lib/mazeAlgorithms.js';
  import Sidebar from './Sidebar.svelte';
  import CanvasView from './CanvasView.svelte';

  // --- Global state (Svelte 5 Runes) ---

  let W = $state(21);
  let H = $state(21);
  let endpointType = $state('exit');
  let currentTool = $state(TOOL.SOLVE);
  let gridData = $state(new Uint8Array(0));

  // Regenerate whenever layout parameters change.
  // Initial generation also runs here on first effect flush.
  $effect(() => {
    // Access all reactive dependencies explicitly.
    const w = W;
    const h = H;
    const ep = endpointType;
    gridData = generateMaze(w, h, ep);
  });

  // Odd-only enforcement for sliders.
  function setW(val) {
    const v = Number(val);
    W = v % 2 === 0 ? v + 1 : v;
  }

  function setH(val) {
    const v = Number(val);
    H = v % 2 === 0 ? v + 1 : v;
  }

  function regenerate() {
    gridData = generateMaze(W, H, endpointType);
  }

  // Portal validation: only one ENTRANCE and one EXIT allowed at a time.
  // Called by CanvasView when the user paints a portal tile.
  function paintCell(index, tool) {
    const next = gridData.slice();

    // Revert any existing portal of the same type to HEDGE before placing the new one.
    if (tool === TOOL.ENTRANCE || tool === TOOL.EXIT) {
      for (let i = 0; i < next.length; i++) {
        if (next[i] === tool) next[i] = TOOL.HEDGE;
      }
    }

    next[index] = tool;
    gridData = next;
  }

  let eraseSolvePath = $state(() => {});
  let autoSolve = $state(() => {});
</script>

<div class="flex flex-col w-screen overflow-y-auto bg-base-100 md:flex-row md:h-screen md:overflow-hidden">
  <CanvasView
    {gridData}
    {W}
    {H}
    {currentTool}
    {paintCell}
    bind:eraseSolvePath
    bind:autoSolve
  />
  <Sidebar
    bind:W
    bind:H
    bind:endpointType
    bind:currentTool
    {setW}
    {setH}
    {regenerate}
    {eraseSolvePath}
    {autoSolve}
  />
</div>
