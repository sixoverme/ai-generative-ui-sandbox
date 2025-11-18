
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface SandboxProps {
  initialContent: string;
  newAppHtml: string | null;
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

  // --- App Readiness Handshake ---
  const readyApps = new Set();
  const scriptQueue = new Map();

  // Listen for apps to signal they are ready
  window.addEventListener('app-ready', (e) => {
    const { appId } = e.detail;
    if (!appId) return;

    console.log('App ' + appId + ' has signaled it is ready.');
    readyApps.add(appId);

    // Run any queued scripts for this app
    if (scriptQueue.has(appId)) {
      console.log('Executing queued scripts for ' + appId);
      const scripts = scriptQueue.get(appId);
      scripts.forEach(script => {
        try {
          new Function(script)();
        } catch (err) {
          console.error('Error executing queued script for ' + appId + ':', err);
        }
      });
      scriptQueue.delete(appId); // Clear the queue for this app
    }
  });
  // --- End App Readiness Handshake ---


  // Signal to the parent that the iframe is ready
  window.parent.postMessage({ type: 'IFRAME_READY' }, '*');

  function makeDraggable(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = elmnt.querySelector('.ai-app-header');
    
    if (header) {
      header.onmousedown = dragMouseDown;
    } else {
      elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
      if (e.target.closest('button, input, textarea, select')) return;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
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

  function initializeWindow(node) {
    if (!node.id || windowStates.has(node.id)) {
        if (!node.id) node.id = 'app-' + Date.now() + Math.random();
    }
    
    windowCount++;
    windowStates.set(node.id, { minimized: false, maximized: false, originalRect: null, zIndex: 1000 + windowCount });
    node.style.zIndex = 1000 + windowCount;
    makeDraggable(node);
    makeResizable(node);

    const resizers = ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'];
    resizers.forEach(direction => {
        const resizer = document.createElement('div');
        resizer.className = "resizer resizer-" + direction;
        node.appendChild(resizer);
    });

    node.querySelector('.btn-close')?.addEventListener('click', () => {
      const icon = document.querySelector(\`.desktop-icon[data-window-id="\${node.id}"]\`);
      if (icon) icon.remove();
      windowStates.delete(node.id);
      readyApps.delete(node.id); // Clean up readiness state
      node.remove();
    });

    node.querySelector('.btn-min')?.addEventListener('click', () => {
      minimizeWindow(node.id, node);
    });

    node.querySelector('.btn-max')?.addEventListener('click', () => {
      const state = windowStates.get(node.id);
      if (state && state.maximized) {
        restoreWindow(node.id);
      } else {
        maximizeWindow(node.id, node);
      }
    });

    node.addEventListener('mousedown', () => {
        bringToFront(node.id);
    });
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

  let highestZIndex = 1000;

  function bringToFront(windowId) {
      const windowEl = document.getElementById(windowId);
      if (windowEl) {
          highestZIndex++;
          windowEl.style.zIndex = highestZIndex;
          windowStates.get(windowId).zIndex = highestZIndex;
      }
  }

  function minimizeWindow(windowId, windowEl) {
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

  function maximizeWindow(windowId, windowEl) {
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
      windowEl.style.transform = 'none';
      state.maximized = true;
      state.minimized = false;
      bringToFront(windowId);
  }

  function restoreWindow(windowId) {
      const windowEl = document.getElementById(windowId);
      const state = windowStates.get(windowId);
      if (!windowEl || !state || (!state.minimized && !state.maximized)) return;

      if (state.minimized) {
          const iconEl = document.querySelector(\`.desktop-icon[data-window-id="\${windowId}"]\`);
          if (iconEl) iconEl.remove();
          windowEl.style.display = '';
          state.minimized = false;
      }

      if (state.maximized) {
          if (state.originalRect) {
            windowEl.style.top = state.originalRect.top;
            windowEl.style.left = state.originalRect.left;
            windowEl.style.width = state.originalRect.width;
            windowEl.style.height = state.originalRect.height;
            windowEl.style.zIndex = state.originalRect.zIndex;
          }
          state.maximized = false;
      }
      state.originalRect = null;
      bringToFront(windowId);
  }

  function parseTargetApp(script) {
    // First, try to find the explicit comment
    const commentMatch = script.match(/\\/\\/\\s*Target App:\\s*([\\w-]+)/);
    if (commentMatch && commentMatch[1]) {
      return commentMatch[1];
    }

    // If no comment, try to infer from document.getElementById or document.querySelector
    const idMatch = script.match(/(?:document\\.getElementById|document\\.querySelector)\\(['"]([\\w-]+)['"]\\)/);
    if (idMatch && idMatch[1]) {
      return idMatch[1];
    }

    return null;
  }

  window.addEventListener('message', (event) => {
    const { type, payload } = event.data;

    if (type === 'ADD_APP') {
      const template = document.createElement('template');
      template.innerHTML = payload.trim();
      const newNode = template.content.firstChild;
      if (newNode && newNode.nodeType === 1) {
          desktop.appendChild(newNode);
          initializeWindow(newNode);
      }
    } else if (type === 'RUN_SCRIPT') {
      const appId = parseTargetApp(payload);
      if (appId && readyApps.has(appId)) {
        // App is ready, run immediately
        try {
          new Function(payload)();
        } catch (e) {
          console.error('Error executing script for ' + appId + ':', e);
        }
      } else if (appId) {
        // App not ready, queue the script
        console.log('App ' + appId + ' not ready. Queuing script.');
        if (!scriptQueue.has(appId)) {
          scriptQueue.set(appId, []);
        }
        scriptQueue.get(appId).push(payload);
      } else {
        // Strict mode: No target, no execution.
        const reason = 'Interaction script failed: No "// Target App: <app-id>" comment found.';
        console.error(reason);
        window.parent.postMessage({ type: 'INTERACTION_FAILED', payload: { reason } }, '*');
      }
    } else if (type === 'CLEAR') {
        desktop.innerHTML = '';
        windowStates.clear();
        readyApps.clear();
        scriptQueue.clear();
        windowCount = 0;
    }
  });

  document.querySelectorAll('.ai-app-window').forEach(initializeWindow);
});
`;

const getIframeSrcDoc = (content: string) => `
<!DOCTYPE html>
<html class="h-full">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="h-full bg-gray-900 bg-grid-gray-700/[0.2] relative overflow-hidden">
  <div id="desktop" class="w-full h-full">${content}</div>
  <script>${iframeScript}<\/script>
  <style>
    .bg-grid-gray-700\\/\\[0\\.2\\] {
        background-image: linear-gradient(to right, rgba(107, 114, 128, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(107, 114, 128, 0.1) 1px, transparent 1px);
        background-size: 20px 20px;
    }
    /* Ensure resizers are visible and on top */
    .resizer {
        position: absolute;
        width: 10px;
        height: 10px;
        background: transparent; /* Make them invisible but functional */
        z-index: 10; /* Ensure they are on top of content */
    }
    .resizer-t { top: -5px; left: 5px; right: 5px; height: 10px; cursor: n-resize; }
    .resizer-b { bottom: -5px; left: 5px; right: 5px; height: 10px; cursor: s-resize; }
    .resizer-l { left: -5px; top: 5px; bottom: 5px; width: 10px; cursor: w-resize; }
    .resizer-r { right: -5px; top: 5px; bottom: 5px; width: 10px; cursor: e-resize; }
    .resizer-tl { top: -5px; left: -5px; width: 10px; height: 10px; cursor: nwse-resize; }
    .resizer-tr { top: -5px; right: -5px; width: 10px; height: 10px; cursor: nesw-resize; }
    .resizer-bl { bottom: -5px; left: -5px; width: 10px; height: 10px; cursor: nesw-resize; }
    .resizer-br { bottom: -5px; right: -5px; width: 10px; height: 10px; cursor: nwse-resize; }
  </style>
</body>
</html>
`;

export const Sandbox: React.FC<SandboxProps> = ({ 
    initialContent, newAppHtml, onAppAdded, scriptToRun, onScriptRun, clear, onClear
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
  }, []);

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
      iframeRef.current.srcdoc = getIframeSrcDoc(initialContent);
      setIframeLoaded(false); // Reset loaded state on srcdoc change
    }
  }, [initialContent]);

  // Send new app HTML via postMessage
  useEffect(() => {
    if (iframeLoaded && newAppHtml && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'ADD_APP', payload: newAppHtml }, '*');
      onAppAdded();
    }
  }, [iframeLoaded, newAppHtml, onAppAdded]);

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
