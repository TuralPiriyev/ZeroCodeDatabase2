Usage
-----

1) Import and include `Toolbox` in your layout (e.g., `App.tsx` or `MainLayout.tsx`):

```tsx
import Toolbox from './components/ui/Toolbox';

function App() {
  return (
    <div>
      <MainLayout />
      <Toolbox id="right-toolbox">
        {/* Your toolbox content here */}
      </Toolbox>
    </div>
  );
}
```

2) Behavior
- Drag with mouse or touch using the handle on the toolbox header.
- Press the "Pin" button to toggle pinned state. Position and pinned state persist in localStorage.
- Dragging near the left edge will snap the toolbox to x=8px when within the configured threshold (default 64px).

3) Optional Popout Sync
- The `Toolbox` component opens a popout window when the Pop button is clicked. For two-way sync across popouts, use BroadcastChannel and send position/pinned updates; keep channel name tied to the `id` prop (e.g., `toolbox:right-toolbox`).
