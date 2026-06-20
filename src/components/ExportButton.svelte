<script>
  import { Download } from '@lucide/svelte';

  function downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hedge-and-seek.png';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPng() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;

    const file = new File([blob], 'hedge-and-seek.png', {
      type: 'image/png',
    });

    const canShareFile =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (!navigator.canShare || navigator.canShare({ files: [file] }));

    if (canShareFile) {
      try {
        await navigator.share({
          files: [file],
          title: 'HedgeSeek export',
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    downloadBlob(blob);
  }
</script>

<button class="btn btn-sm btn-success gap-2 w-full" onclick={exportPng}>
  <Download size={14} />
  Save Image
</button>
