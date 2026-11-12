// Runs inside the website before it loads. A web view can't save the files the site creates in
// the browser (Excel, PDF, Word reports made from a blob or data URL), so those clicks are sent to
// the app as base64 instead, and the app offers them to the phone's share/save sheet.
// It also reports the site's theme colours so the status bar matches the page.
export const BRIDGE_SCRIPT = `
(function () {
  if (window.__nfsBridge) return;
  window.__nfsBridge = true;
  var send = function (message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); };

  var isFileLink = function (a) {
    var href = a.href || "";
    return a.hasAttribute("download") && (href.indexOf("blob:") === 0 || href.indexOf("data:") === 0);
  };
  var saveLink = function (a) {
    var name = a.getAttribute("download") || "download";
    fetch(a.href)
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        var reader = new FileReader();
        reader.onload = function () {
          var data = String(reader.result);
          send({ type: "download", name: name, mime: blob.type || "application/octet-stream", base64: data.slice(data.indexOf(",") + 1) });
        };
        reader.readAsDataURL(blob);
      })
      .catch(function (err) { send({ type: "downloadFailed", message: String(err) }); });
  };

  // Sites free a blob URL right after clicking its link; keep it alive long enough to read it.
  var revoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function (url) { setTimeout(function () { revoke(url); }, 30000); };

  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isFileLink(this)) return saveLink(this);
    return click.apply(this, arguments);
  };
  var dispatch = HTMLAnchorElement.prototype.dispatchEvent;
  HTMLAnchorElement.prototype.dispatchEvent = function (event) {
    if (event && event.type === "click" && isFileLink(this)) { saveLink(this); return false; }
    return dispatch.apply(this, arguments);
  };
  document.addEventListener("click", function (event) {
    var a = event.target && event.target.closest ? event.target.closest("a") : null;
    if (a && isFileLink(a)) { event.preventDefault(); saveLink(a); }
  }, true);

  window.print = function () { send({ type: "print" }); };

  var reportTheme = function () {
    var css = getComputedStyle(document.documentElement);
    var primary = css.getPropertyValue("--primary").trim();
    var background = css.getPropertyValue("--background").trim();
    send({ type: "theme", primary: primary ? "hsl(" + primary.split(" ").join(", ") + ")" : "", background: background ? "hsl(" + background.split(" ").join(", ") + ")" : "" });
  };
  document.addEventListener("DOMContentLoaded", reportTheme);
  setTimeout(reportTheme, 2500);
})();
true;
`;
