// A stand-in for Mallard's window.panel, for dev/preview.html. Classic script: it must run before
// ../ui/main.js so window.panel exists when the panel registers its handlers and posts "ready".
//
//   window.fakePanel.emit(name, data)  call the panel's on(name) handlers, as the Lua side would
//   window.fakePanel.onPost(fn)        fn(name, data) for every post, including ones already queued
//   window.fakePanel.posts             every post the panel has made, in order

(function () {
  "use strict";
  var handlers = {};
  var posts = [];
  var listeners = [];
  var tip = null;

  window.panel = {
    on: function (name, fn) {
      (handlers[name] = handlers[name] || []).push(fn);
    },
    post: function (name, data) {
      posts.push({ name: name, data: data });
      listeners.forEach(function (fn) { fn(name, data); });
    },
    tooltip: {
      // a plain box near the hovered element, so tooltips can be eyeballed in the preview
      show: function (rect, content) {
        if (!tip) {
          tip = document.createElement("div");
          tip.style.cssText =
            "position:fixed;z-index:10;max-width:220px;padding:4px 7px;border-radius:4px;pointer-events:none;" +
            "font:11px system-ui,sans-serif;background:#1b2330;color:#e3eaf2;border:1px solid #3b4a5c";
          document.body.appendChild(tip);
        }
        var c = content || {};
        var rows = (c.rows || []).map(function (r) { return r.label + ": " + (r.value || ""); });
        tip.textContent = [c.title, c.body].concat(rows).filter(Boolean).join(" · ");
        tip.style.left = Math.round(rect.left) + "px";
        tip.style.top = Math.round(rect.bottom + 4) + "px";
        tip.style.display = "";
      },
      hide: function () {
        if (tip) tip.style.display = "none";
      },
    },
  };

  window.fakePanel = {
    posts: posts,
    emit: function (name, data) {
      (handlers[name] || []).forEach(function (fn) { fn(data); });
    },
    onPost: function (fn) {
      listeners.push(fn);
      posts.forEach(function (p) { fn(p.name, p.data); });
    },
  };
})();
