/* WAS RetroArch Player v2024.12.28.1155 */
import { app } from "../../scripts/app.js";

console.log("[WAS RetroArch] ===== SCRIPT LOADED v2024.12.28.1155 =====");

const EXT_NAME = "WAS.RetroArchPlayer";
const NODE_NAME = "ComfyRetroArchPlayer";

const DEFAULT_NODE_SIZE = [980, 600];

const STATE = {
  container: null,
  nodeIdToIframe: new Map(),
  cleanupIntervalId: null,
  cleanupListenersAttached: false,
};

function getActiveGraphNodes() {
  const g = app?.graph || app?.canvas?.graph;
  const nodes = g?._nodes || g?.nodes;
  return Array.isArray(nodes) ? nodes : [];
}

function isRetroArchPlayerNode(node) {
  try {
    return (
      node?.comfyClass === NODE_NAME ||
      node?.type === NODE_NAME ||
      node?.constructor?.comfyClass === NODE_NAME ||
      node?.constructor?.type === NODE_NAME
    );
  } catch (e) {
    return false;
  }
}

function removeIframeByKey(key) {
  try {
    const iframe = STATE.nodeIdToIframe.get(key);
    if (!iframe) return;
    iframe.remove();
  } catch (e) {
  } finally {
    STATE.nodeIdToIframe.delete(key);
  }
}

function cleanupOrphanIframes() {
  try {
    const nodes = getActiveGraphNodes();
    const activeIds = new Set(
      nodes
        .filter((n) => isRetroArchPlayerNode(n))
        .map((n) => String(n.id))
    );

    for (const key of Array.from(STATE.nodeIdToIframe.keys())) {
      if (!activeIds.has(key)) {
        removeIframeByKey(key);
      }
    }

    if (STATE.nodeIdToIframe.size === 0 && STATE.container) {
      try {
        STATE.container.remove();
      } catch (e) {
      }
      STATE.container = null;
    }
  } catch (e) {
  }
}

function ensureCleanupRunning() {
  if (STATE.cleanupIntervalId != null) return;
  STATE.cleanupIntervalId = window.setInterval(() => cleanupOrphanIframes(), 1000);
  if (!STATE.cleanupListenersAttached) {
    STATE.cleanupListenersAttached = true;
    const onVis = () => cleanupOrphanIframes();
    const onFocus = () => cleanupOrphanIframes();
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
  }
}

function getContainer() {
  if (STATE.container) return STATE.container;
  const el = document.createElement("div");
  el.id = "was-retroarch-overlay";
  el.style.position = "absolute";
  el.style.left = "0";
  el.style.top = "0";
  el.style.width = "0";
  el.style.height = "0";
  el.style.pointerEvents = "none";
  el.style.zIndex = "100";
  document.body.appendChild(el);
  STATE.container = el;
  return el;
}

function ensureIframeForNode(node) {
  cleanupOrphanIframes();
  ensureCleanupRunning();

  const key = String(node.id);
  const existing = STATE.nodeIdToIframe.get(key);
  if (existing) return existing;

  const iframe = document.createElement("iframe");
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-forms allow-popups allow-downloads allow-pointer-lock"
  );
  iframe.style.position = "absolute";
  iframe.style.border = "0";
  iframe.style.pointerEvents = "auto";
  iframe.style.background = "#000";
  iframe.style.left = "0px";
  iframe.style.top = "0px";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.display = "none";
  iframe.style.borderRadius = "8px";

  
  iframe.src = "https://web.libretro.com/";
  iframe.allowFullscreen = true;
  iframe.allow = "fullscreen";
  
  getContainer().appendChild(iframe);
  STATE.nodeIdToIframe.set(key, iframe);

  const oldOnRemoved = node.onRemoved;
  node.onRemoved = function () {
    try {
      removeIframeByKey(String(this.id));
      cleanupOrphanIframes();
    } catch (e) {
    }
    return oldOnRemoved ? oldOnRemoved.apply(this, arguments) : undefined;
  };

  return iframe;
}

function updateIframeRect(node, iframe) {
  const canvas = app.canvas;
  const canvasEl = canvas?.canvas;
  if (!canvasEl) return;

  const rect = canvasEl.getBoundingClientRect();
  const ds = canvas.ds;
  const scale = ds?.scale ?? 1;
  const offset = ds?.offset ?? [0, 0];

  const x = rect.left + (node.pos[0] + offset[0]) * scale;
  const y = rect.top + (node.pos[1] + offset[1]) * scale;
  const w = node.size[0] * scale;
  const h = node.size[1] * scale;

  const titleHRaw =
    (typeof node?.title_height === "number" && Number.isFinite(node.title_height) && node.title_height) ||
    (typeof node?.constructor?.title_height === "number" &&
      Number.isFinite(node.constructor.title_height) &&
      node.constructor.title_height) ||
    globalThis?.LiteGraph?.NODE_TITLE_HEIGHT ||
    30;
  const titleH = titleHRaw * scale;
  const insetX = 8 * scale;
  const insetTop = 0;
  const insetBottom = 8 * scale;
  const headerAdjust = 20 * scale;
  const innerX = x + insetX;
  const innerY = y + titleH + insetTop - headerAdjust;
  const innerW = w - insetX * 2;
  const innerH = h - titleH - insetTop - insetBottom + headerAdjust;

  const nx = Number.isFinite(innerX) ? innerX : 0;
  const ny = Number.isFinite(innerY) ? innerY : 0;
  const nw = Number.isFinite(innerW) ? innerW : 0;
  const nh = Number.isFinite(innerH) ? innerH : 0;

  iframe.style.left = `${Math.round(nx)}px`;
  iframe.style.top = `${Math.round(ny)}px`;
  iframe.style.width = `${Math.max(0, Math.round(nw / scale))}px`;
  iframe.style.height = `${Math.max(0, Math.round(nh / scale))}px`;
  iframe.style.transform = `scale(${scale})`;
  iframe.style.transformOrigin = 'top left';

  const isCollapsed = !!node.flags?.collapsed;
  const hasArea = nw >= 2 && nh >= 2;
  iframe.style.display = !isCollapsed && hasArea ? "block" : "none";
}

app.registerExtension({
  name: EXT_NAME,
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== NODE_NAME) return;

    ensureCleanupRunning();

    const oldOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = oldOnNodeCreated ? oldOnNodeCreated.apply(this, arguments) : undefined;
      try {
        if (!Array.isArray(this.size) || this.size.length < 2) {
          this.size = [...DEFAULT_NODE_SIZE];
        } else {
          this.size[0] = Math.max(this.size[0] ?? 0, DEFAULT_NODE_SIZE[0]);
          this.size[1] = Math.max(this.size[1] ?? 0, DEFAULT_NODE_SIZE[1]);
        }
        this.setDirtyCanvas?.(true, true);
      } catch (e) {
      }
      return r;
    };

    const oldOnDrawForeground = nodeType.prototype.onDrawForeground;
    nodeType.prototype.onDrawForeground = function (ctx) {
      const r = oldOnDrawForeground ? oldOnDrawForeground.apply(this, arguments) : undefined;
      try {
        const iframe = ensureIframeForNode(this);
        updateIframeRect(this, iframe);
      } catch (e) {
      }
      return r;
    };

    const oldOnResize = nodeType.prototype.onResize;
    nodeType.prototype.onResize = function (size) {
      const r = oldOnResize ? oldOnResize.apply(this, arguments) : undefined;
      try {
        const iframe = ensureIframeForNode(this);
        updateIframeRect(this, iframe);
      } catch (e) {
      }
      return r;
    };
  },
});
