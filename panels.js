(function () {
    // ---- knobs ----
    var SIZES = {                      // final panel size in px (shrinks to fit small screens)
        about:   { w: 860, h: 560 },
        resume:  { w: 980, h: 780 },
        contact: { w: 520, h: 470 }
    };
    var OPEN_MS = 650;                 // zoom open
    var CLOSE_MS = 480;                // zoom close
    var CHAR_MS = 15;                  // typing speed (ms per letter)
    var PAUSE_END = 240;               // extra pause after . ! ?
    var PAUSE_COMMA = 90;              // extra pause after ,
    var EMAIL_USER = 'pabal';          // email is built from these two parts
    var EMAIL_HOST = 'pabal.dev';

    var root = document.documentElement;
    var stage = document.getElementById('stage');
    var scrim = document.getElementById('scrim');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var narrow = window.matchMedia('(max-width: 800px), (max-aspect-ratio: 1/1)');
    var EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

    var current = null;   // { name, panel, glass, node, from }
    var busy = false;
    var typer = null;

    function email() { return EMAIL_USER + '@' + EMAIL_HOST; }

    // ---------- geometry ----------
    function finalRect(name) {
        var s = SIZES[name];
        var w = Math.min(window.innerWidth * 0.94, s.w);
        var h = Math.min(window.innerHeight * 0.9, s.h);
        return { left: (window.innerWidth - w) / 2, top: (window.innerHeight - h) / 2, width: w, height: h };
    }
    function setRect(el, r) {
        el.style.left = r.left + 'px';
        el.style.top = r.top + 'px';
        el.style.width = r.width + 'px';
        el.style.height = r.height + 'px';
    }
    function frameOf(r, radius) {
        return {
            left: r.left + 'px', top: r.top + 'px',
            width: r.width + 'px', height: r.height + 'px',
            borderRadius: radius + 'px'
        };
    }

    // ---------- typewriter ----------
    // Every letter becomes a hidden span. A screen-reader copy of the text stays in the page.
    function prep(panel) {
        var chars = [];
        Array.prototype.forEach.call(panel.querySelectorAll('.tw'), function (el) {
            var text = el.textContent.replace(/\s+/g, ' ').trim();
            el.textContent = '';
            var sr = document.createElement('span');
            sr.className = 'sr-only';
            sr.textContent = text;
            var vis = document.createElement('span');
            vis.setAttribute('aria-hidden', 'true');
            var words = text.split(' ');
            words.forEach(function (word, wi) {
                var w = document.createElement('span');
                w.className = 'w';
                Array.prototype.forEach.call(word, function (ch) {
                    var c = document.createElement('span');
                    c.className = 'c';
                    c.textContent = ch;
                    w.appendChild(c);
                    chars.push(c);
                });
                vis.appendChild(w);
                if (wi < words.length - 1) vis.appendChild(document.createTextNode(' '));
            });
            el.appendChild(sr);
            el.appendChild(vis);
        });
        panel._chars = chars;
    }

    function resetType(panel) {
        (panel._chars || []).forEach(function (c) { c.className = 'c'; });
        Array.prototype.forEach.call(panel.querySelectorAll('.after'), function (a) { a.classList.remove('in'); });
        var hint = panel.querySelector('.skip-hint');
        if (hint) hint.classList.remove('gone');
    }

    function finishType(panel) {
        if (!typer || typer.panel !== panel) return;
        cancelAnimationFrame(typer.raf);
        var chars = panel._chars;
        chars.forEach(function (c) { c.classList.add('on'); c.classList.remove('cur'); });
        if (chars.length) chars[chars.length - 1].classList.add('cur');
        var end = chars[chars.length - 1];
        setTimeout(function () { if (end) end.classList.remove('cur'); }, 2500);
        Array.prototype.forEach.call(panel.querySelectorAll('.after'), function (a) { a.classList.add('in'); });
        var hint = panel.querySelector('.skip-hint');
        if (hint) hint.classList.add('gone');
        panel.removeEventListener('pointerdown', typer.skip);
        typer = null;
    }

    function startType(panel) {
        var chars = panel._chars;
        if (!chars || !chars.length) return;
        resetType(panel);
        typer = { panel: panel, raf: 0, skip: null };
        if (reduce) { finishType(panel); return; }

        // when each letter appears
        var times = [], t = 250;
        chars.forEach(function (c) {
            times.push(t);
            var ch = c.textContent;
            t += CHAR_MS;
            if (ch === '.' || ch === '!' || ch === '?') t += PAUSE_END;
            else if (ch === ',') t += PAUSE_COMMA;
        });

        var shown = 0, last = null, t0 = performance.now();
        var me = typer;
        me.skip = function () { finishType(panel); };
        panel.addEventListener('pointerdown', me.skip);

        function tick(now) {
            if (typer !== me) return;
            var el = now - t0;
            while (shown < chars.length && times[shown] <= el) {
                var c = chars[shown++];
                c.classList.add('on');
                if (last) last.classList.remove('cur');
                c.classList.add('cur');
                last = c;
            }
            if (shown >= chars.length) { finishType(panel); return; }
            me.raf = requestAnimationFrame(tick);
        }
        me.raf = requestAnimationFrame(tick);
    }

    // ---------- open / close ----------
    function focusables(panel) {
        return Array.prototype.filter.call(
            panel.querySelectorAll('a[href], button:not([disabled])'),
            function (el) { return !el.hidden && el.offsetParent !== null; }
        );
    }

    function openPanel(name, glass) {
        if (current || busy) return;
        var panel = document.getElementById('panel-' + name);
        if (!panel) return;
        busy = true;

        var node = glass.closest('.node');
        var from = glass.getBoundingClientRect();
        var to = finalRect(name);
        var radius = parseFloat(window.getComputedStyle(glass).borderTopLeftRadius) || 14;

        // zoom the scene toward the box that was clicked
        if (!narrow.matches) {
            var sr = stage.getBoundingClientRect();
            stage.style.transformOrigin =
                (from.left + from.width / 2 - sr.left) + 'px ' + (from.top + from.height / 2 - sr.top) + 'px';
        }

        current = { name: name, panel: panel, glass: glass, node: node, from: from };
        panel.classList.remove('ready');
        resetType(panel);
        panel.hidden = false;
        setRect(panel, to);
        panel.style.borderRadius = '22px';
        if (node) node.classList.add('morphing');
        root.classList.add('panel-open');

        // stagger index for resume / contact blocks
        Array.prototype.forEach.call(panel.querySelectorAll('.stagger > *'), function (el, i) {
            el.style.setProperty('--i', i);
        });

        var anim = panel.animate(
            [frameOf(from, radius), frameOf(to, 22)],
            { duration: reduce ? 0 : OPEN_MS, easing: EASE }
        );
        anim.finished.then(function () {
            panel.classList.add('ready');
            busy = false;
            var btn = panel.querySelector('.panel-x');
            if (btn) btn.focus({ preventScroll: true });
            if (panel._chars) startType(panel);
        }, function () { busy = false; });
    }

    function closePanel() {
        if (!current || busy) return;
        busy = true;
        var c = current;
        var panel = c.panel;

        if (typer) { cancelAnimationFrame(typer.raf); panel.removeEventListener('pointerdown', typer.skip); typer = null; }
        panel.classList.remove('ready');
        root.classList.remove('panel-open');

        var cur = panel.getBoundingClientRect();
        var radius = parseFloat(window.getComputedStyle(c.glass).borderTopLeftRadius) || 14;
        var anim = panel.animate(
            [frameOf(cur, 22), frameOf(c.from, radius)],
            { duration: reduce ? 0 : CLOSE_MS, easing: EASE, fill: 'forwards' }
        );
        anim.finished.then(function () {
            panel.hidden = true;
            anim.cancel();
            if (c.node) c.node.classList.remove('morphing');
            c.glass.focus({ preventScroll: true });
            current = null;
            busy = false;
        }, function () { busy = false; });
    }

    // ---------- wiring ----------
    Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'), function (a) {
        a.addEventListener('click', function (e) {
            e.preventDefault();
            openPanel(a.getAttribute('data-panel'), a);
        });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.panel-x'), function (b) {
        b.addEventListener('click', closePanel);
    });
    scrim.addEventListener('click', closePanel);

    document.addEventListener('keydown', function (e) {
        if (!current) return;
        if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
        if (typer && (e.key === ' ' || e.key === 'Enter') && !e.target.closest('button, a')) {
            e.preventDefault();
            finishType(current.panel);
            return;
        }
        if (e.key === 'Tab') {          // keep focus inside the open panel
            var f = focusables(current.panel);
            if (!f.length) return;
            var first = f[0], lastEl = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
            else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
            else if (!current.panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        }
    });

    window.addEventListener('resize', function () {
        if (current && !busy) setRect(current.panel, finalRect(current.name));
    });

    // type-out panels get prepared once
    Array.prototype.forEach.call(document.querySelectorAll('.panel'), function (p) {
        if (p.querySelector('.tw')) prep(p);
    });

    // ---------- contact ----------
    var mailText = document.getElementById('mail-text');
    var mailSend = document.getElementById('mail-send');
    var mailCopy = document.getElementById('mail-copy');
    if (mailText) mailText.textContent = email();
    if (mailSend) mailSend.setAttribute('href', 'mailto:' + email());
    if (mailCopy) {
        mailCopy.addEventListener('click', function () {
            function done() {
                mailCopy.textContent = 'copied ✓';
                setTimeout(function () { mailCopy.textContent = 'copy email'; }, 1800);
            }
            function fallback() {
                var range = document.createRange();
                range.selectNodeContents(mailText);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                try { if (document.execCommand('copy')) done(); } catch (err) { /* user can copy by hand */ }
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(email()).then(done, fallback);
            } else {
                fallback();
            }
        });
    }
})();
