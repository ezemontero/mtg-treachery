// Vertical fit. The compact layout is tuned for short phones (a 6.1" iPhone in
// Safari); on taller screens the spare height would just pile up at the bottom.
// So spacing grows into it: --grow goes from 0px (compact) to 1px (comfortable)
// and styles.css scales paddings, gaps and a few sizes with it. It never grows
// past what fits, so a full lobby still stays on one screen. The card view keeps
// it at 0 and gives its spare height to the card instead (room.js fitCard).
const app = document.querySelector('.app');

// The small viewport (browser bars shown): innerHeight changes while Safari
// hides its bars on scroll, which would make the layout jump.
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
document.body.append(probe);
const viewport = () => probe.offsetHeight || innerHeight;

export function fitSpacing() {
  if (!app) return;
  if (document.querySelector('#view-role:not(.hidden)')) {
    app.style.setProperty('--grow', '0px');
    return;
  }
  // Measure the content itself: with flex none the app hugs its children, and
  // the footer's auto margin collapses.
  const heightAt = (g) => {
    app.style.setProperty('--grow', `${g}px`);
    return app.offsetHeight;
  };
  app.style.flex = 'none';
  const compact = heightAt(0);
  const comfortable = heightAt(1);
  const spare = viewport() - compact;
  let g = comfortable > compact ? Math.min(1, Math.max(0, spare / (comfortable - compact))) : 0;
  // Bigger text can wrap onto a new line; back off until it fits.
  for (let i = 0; i < 5 && g > 0 && heightAt(g) > viewport(); i++) g = Math.max(0, g - 0.15);
  app.style.flex = '';
  app.style.setProperty('--grow', `${g}px`);
}

// Refit when the content changes (lists, views, errors, language) or the
// screen does — once per frame at most.
let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; fitSpacing(); });
}
if (app) {
  new MutationObserver(schedule).observe(app, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'],
  });
}
let size = `${innerWidth}x${viewport()}`;
window.addEventListener('resize', () => {
  const now = `${innerWidth}x${viewport()}`;
  if (now === size) return;
  size = now;
  schedule();
});
schedule();
