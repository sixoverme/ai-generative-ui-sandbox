
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface SandboxProps {
  appsToRestore: { title: string; html: string }[];
  newApp: { title: string; html: string } | null;
  onAppAdded: () => void;
  scriptToRun: string | null;
  onScriptRun: () => void;
  clear: boolean;
  onClear: () => void;
}

const iframeScript = `
document.addEventListener('DOMContentLoaded', () => {
  const desktop = document.getElementById('desktop');
  const windowStates = new Map();
  let windowCount = 0;
  let highestZIndex = 1000; // Starting z-index for windows

  // Signal to the parent that the iframe is ready
  window.parent.postMessage({ type: 'IFRAME_READY' }, '*');

  function makeDraggable(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = elmnt.querySelector('.ai-app-header');
    if (!header) return;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      // Only drag if the clicked element is the header itself, not a button inside it.
      if (e.target.closest('button, input, textarea, select')) {
        return;
      }
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      bringToFront(elmnt.id);
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  function makeIconDraggable(icon) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    icon.onmousedown = (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
        document.onmousemove = (ev) => {
            ev.preventDefault();
            pos1 = pos3 - ev.clientX;
            pos2 = pos4 - ev.clientY;
            pos3 = ev.clientX;
            pos4 = ev.clientY;
            icon.style.top = (icon.offsetTop - pos2) + "px";
            icon.style.left = (icon.offsetLeft - pos1) + "px";
        };
    };
  }

  function makeResizable(elmnt) {
    const resizers = elmnt.querySelectorAll('.resizer');
    let currentResizer;

    function mouseDown(e) {
      currentResizer = e.target;
      let prevX = e.clientX;
      let prevY = e.clientY;
      const originalWidth = elmnt.offsetWidth;
      const originalHeight = elmnt.offsetHeight;
      const originalLeft = elmnt.offsetLeft;
      const originalTop = elmnt.offsetTop;

      function mouseMove(e) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;

        if (currentResizer.classList.contains('resizer-b')) {
          elmnt.style.height = (originalHeight + dy) + 'px';
        } else if (currentResizer.classList.contains('resizer-br')) {
          elmnt.style.width = (originalWidth + dx) + 'px';
          elmnt.style.height = (originalHeight + dy) + 'px';
        } else if (currentResizer.classList.contains('resizer-bl')) {
          elmnt.style.width = (originalWidth - dx) + 'px';
          elmnt.style.height = (originalHeight + dy) + 'px';
          elmnt.style.left = (originalLeft + dx) + 'px';
        } else if (currentResizer.classList.contains('resizer-r')) {
          elmnt.style.width = (originalWidth + dx) + 'px';
        } else if (currentResizer.classList.contains('resizer-l')) {
          elmnt.style.width = (originalWidth - dx) + 'px';
          elmnt.style.left = (originalLeft + dx) + 'px';
        } else if (currentResizer.classList.contains('resizer-tl')) {
          elmnt.style.width = (originalWidth - dx) + 'px';
          elmnt.style.height = (originalHeight - dy) + 'px';
          elmnt.style.left = (originalLeft + dx) + 'px';
          elmnt.style.top = (originalTop + dy) + 'px';
        } else if (currentResizer.classList.contains('resizer-t')) {
          elmnt.style.height = (originalHeight - dy) + 'px';
          elmnt.style.top = (originalTop + dy) + 'px';
        } else if (currentResizer.classList.contains('resizer-tr')) {
          elmnt.style.width = (originalWidth + dx) + 'px';
          elmnt.style.height = (originalHeight - dy) + 'px';
          elmnt.style.top = (originalTop + dy) + 'px';
        }
      }

      function mouseUp() {
        document.removeEventListener('mousemove', mouseMove);
        document.removeEventListener('mouseup', mouseUp);
      }

      document.addEventListener('mousemove', mouseMove);
      document.addEventListener('mouseup', mouseUp);
    }

    resizers.forEach(resizer => {
      resizer.addEventListener('mousedown', mouseDown);
    });
  }

  let highestZIndex = 1000; // Starting z-index for windows

  }

  function bringToFront(windowId) {
      const windowEl = document.getElementById(windowId);
      if (windowEl && windowStates.has(windowId)) {
          highestZIndex++;
          windowEl.style.zIndex = highestZIndex;
          windowStates.get(windowId).zIndex = highestZIndex;
      }
  }

  function minimizeWindow(windowId) {
      const windowEl = document.getElementById(windowId);
      if (!windowEl) return;
      const state = windowStates.get(windowId);
      if (!state || state.minimized) return;
      
      state.originalRect = {
          top: windowEl.style.top,
          left: windowEl.style.left,
          width: windowEl.style.width,
          height: windowEl.style.height,
          zIndex: windowEl.style.zIndex,
      };

      windowEl.style.display = 'none';
      state.minimized = true;
      state.maximized = false;
      
      const title = windowEl.querySelector('.app-title-text')?.textContent || 'Application';
      const icon = document.createElement('div');
      icon.className = 'desktop-icon absolute flex flex-col items-center p-2 rounded-lg hover:bg-white/10 cursor-pointer w-24 text-center';
      icon.dataset.windowId = windowId;
      icon.style.left = \`\${(Array.from(windowStates).filter(([k,v]) => v.minimized).length % 10) * 100 + 20}px\`;
      icon.style.top = \`\${Math.floor(Array.from(windowStates).filter(([k,v]) => v.minimized).length / 10) * 120 + 20}px\`;
      icon.innerHTML = \`
        <svg class="w-10 h-10 text-white mb-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
        <span class="text-xs text-white truncate w-full pointer-events-none">\${title}</span>
      \`;
      
      desktop.appendChild(icon);
      makeIconDraggable(icon);
      
      icon.addEventListener('dblclick', () => restoreWindow(windowId));
  }

  function maximizeWindow(windowId) {
      const windowEl = document.getElementById(windowId);
      if (!windowEl) return;
      const state = windowStates.get(windowId);
      if (!state || state.maximized) return;

      state.originalRect = {
          top: windowEl.style.top,
          left: windowEl.style.left,
          width: windowEl.style.width,
          height: windowEl.style.height,
          zIndex: windowEl.style.zIndex,
      };

      windowEl.style.top = '0px';
      windowEl.style.left = '0px';
      windowEl.style.width = '100%';
      windowEl.style.height = '100%';
      state.maximized = true;
      state.minimized = false;
      bringToFront(windowId);
  }

  function restoreWindow(windowId) {
      const windowEl = document.getElementById(windowId);
      if (!windowEl) return;
      const state = windowStates.get(windowId);
      if (!state || (!state.minimized && !state.maximized)) return;

      if (state.minimized) {
          const iconEl = document.querySelector(\`.desktop-icon[data-window-id="\${windowId}"]\`);
          if (iconEl) iconEl.remove();
          windowEl.style.display = '';
          state.minimized = false;
      }

      if (state.maximized && state.originalRect) {
          windowEl.style.top = state.originalRect.top;
          windowEl.style.left = state.originalRect.left;
          windowEl.style.width = state.originalRect.width;
          windowEl.style.height = state.originalRect.height;
          windowEl.style.zIndex = state.originalRect.zIndex;
          state.maximized = false;
          state.originalRect = null;
      }
      bringToFront(windowId);
  }

  function createAppWindow(title, contentHtml) {
    const windowId = 'app-' + Date.now() + Math.random();
    const win = document.createElement('div');
    win.className = 'ai-app-window flex flex-col bg-gray-800 border border-gray-600 rounded-lg shadow-lg';
    win.id = windowId;

    // Default/cascading position and size
    const cascadeOffset = (windowCount % 10) * 30;
    win.style.position = 'absolute';
    win.style.top = (20 + cascadeOffset) + 'px';
    win.style.left = (20 + cascadeOffset) + 'px';
    win.style.width = '450px';
    win.style.height = '350px';

    win.innerHTML = \`
      <div class="ai-app-header flex items-center justify-between p-1 bg-gray-700 text-white rounded-t-lg cursor-move">
        <span class="app-title-text font-bold text-sm ml-2">\${title}</span>
        <div class="window-controls flex space-x-1">
          <button class="btn-min w-4 h-4 rounded-full bg-yellow-500 hover:bg-yellow-600"></button>
          <button class="btn-max w-4 h-4 rounded-full bg-green-500 hover:bg-green-600"></button>
          <button class="btn-close w-4 h-4 rounded-full bg-red-500 hover:bg-red-600"></button>
        </div>
      </div>
      <div class="ai-app-content flex-1 p-2 bg-gray-800/80 backdrop-blur-sm overflow-auto"></div>
    \`;

    const contentArea = win.querySelector('.ai-app-content');
    contentArea.innerHTML = contentHtml;

    // Add resize handles
    const resizers = ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'];
    resizers.forEach(direction => {
        const resizer = document.createElement('div');
        resizer.className = "resizer resizer-" + direction;
        win.appendChild(resizer);
    });

    desktop.appendChild(win);
    windowCount++;

    // Store state and apply behaviors
    windowStates.set(windowId, { minimized: false, maximized: false, originalRect: null, zIndex: 1000 + windowCount });
    win.style.zIndex = 1000 + windowCount;
    highestZIndex = 1000 + windowCount;

    makeDraggable(win);
    makeResizable(win);

    win.querySelector('.btn-close').addEventListener('click', () => {
      const icon = document.querySelector(\`.desktop-icon[data-window-id="\${windowId}"]\`);
      if (icon) icon.remove();
      windowStates.delete(windowId);
      win.remove();
    });

    win.querySelector('.btn-min').addEventListener('click', () => minimizeWindow(windowId));
    win.querySelector('.btn-max').addEventListener('click', () => {
        const state = windowStates.get(windowId);
        if (state && state.maximized) {
            restoreWindow(windowId);
        } else {
            maximizeWindow(windowId);
        }
    });

    win.addEventListener('mousedown', () => bringToFront(windowId));
  }

  window.addEventListener('message', (event) => {
    const { type, payload } = event.data;

    if (type === 'RESTORE_APPS') {
        if (Array.isArray(payload)) {
            payload.forEach(app => createAppWindow(app.title, app.html));
        }
    } else if (type === 'ADD_APP') {
      // Payload should be { title: '...', html: '...' }
      if (payload && payload.title && payload.html) {
          createAppWindow(payload.title, payload.html);
      }
    } else if (type === 'RUN_SCRIPT') {
      try {
        setTimeout(() => { new Function(payload)(); }, 100);
      } catch (e) {
        console.error('Error executing script:', e);
      }
    } else if (type === 'CLEAR') {
        desktop.innerHTML = '';
        windowStates.clear();
        windowCount = 0;
        highestZIndex = 1000;
    }
  });
});
`;

// Note: The new architecture does not rely on initialContent for windows.
// The host app should send 'ADD_APP' messages to restore state.
const getIframeSrcDoc = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 bg-grid-gray-700/[0.2] relative overflow-hidden">
  <div id="desktop" class="w-full h-full">${content}</div>
  <script>${iframeScript}<\/script>
  <style>
    .bg-grid-gray-700\\/\\[0\\.2\\] {
        background-image: linear-gradient(to right, rgba(107, 114, 128, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(107, 114, 128, 0.1) 1px, transparent 1px);
        background-size: 20px 20px;
    }
  </style>
</body>
</html>
`;

export const Sandbox: React.FC<SandboxProps> = ({
    appsToRestore, newApp, onAppAdded, scriptToRun, onScriptRun, clear, onClear
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data.type === 'IFRAME_READY') {
        setIframeLoaded(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  // Set initial content only once
  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = getIframeSrcDoc(""); // Start with an empty desktop
      setIframeLoaded(false); // Reset loaded state on srcdoc change
    }
  }, []);

  // Restore apps when iframe is ready
  useEffect(() => {
    if (iframeLoaded && appsToRestore.length > 0 && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'RESTORE_APPS', payload: appsToRestore }, '*');
    }
  }, [iframeLoaded, appsToRestore]);

  // Send new app HTML via postMessage
  useEffect(() => {
    if (iframeLoaded && newApp && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'ADD_APP', payload: newApp }, '*');
      onAppAdded();
    }
  }, [iframeLoaded, newApp, onAppAdded]);

  // Send script to run via postMessage
  useEffect(() => {
    if (iframeLoaded && scriptToRun && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'RUN_SCRIPT', payload: scriptToRun }, '*');
      onScriptRun();
    }
  }, [iframeLoaded, scriptToRun, onScriptRun]);

  // Send clear command via postMessage
  useEffect(() => {
    if (iframeLoaded && clear && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'CLEAR' }, '*');
      onClear();
    }
  }, [iframeLoaded, clear, onClear]);

  return (
    <div className="flex-1 bg-gray-900 p-2">
      <iframe
        ref={iframeRef}
        title="Sandbox"
        className="w-full h-full border-2 border-gray-700 rounded-lg"
        sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
        onLoad={handleIframeLoad}
      />
    </div>
  );
};
