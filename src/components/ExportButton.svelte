<script>
  import { Download } from '@lucide/svelte';

  function exportPng() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hedge-and-seek.png';
    a.click();
  }
</script>

<button class="btn btn-sm btn-success gap-2 w-full" onclick={exportPng}>
  <Download size={14} />
  Export PNG
</button>
