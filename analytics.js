/*
 * Privacy-first page counter (GoatCounter, EU-hosted, no cookies).
 * - Not loaded at all when the browser sends Global Privacy Control or Do Not Track.
 * - Loaded with Subresource Integrity: if the remote file ever changes, the browser refuses to run it.
 * - Visitors can also opt out by opening https://formentineric.github.io/#toggle-goatcounter
 *
 * To update GoatCounter: take the new versioned URL + integrity hash from
 * https://www.goatcounter.com/help/countjs-versions and update both values below.
 */
(function () {
    'use strict';

    var GOATCOUNTER_ENDPOINT = 'https://formentineric.goatcounter.com/count';
    var SCRIPT_URL = 'https://gc.zgo.at/count.v5.js';
    var SCRIPT_SRI = 'sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ';

    var gpc = navigator.globalPrivacyControl === true;
    var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';
    if (gpc || dnt) return;

    var script = document.createElement('script');
    script.async = true;
    script.src = SCRIPT_URL;
    script.integrity = SCRIPT_SRI;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-goatcounter', GOATCOUNTER_ENDPOINT);
    document.head.appendChild(script);
})();
