(function () {
    // ---- knobs ----
    var FACE_RX = 8.2;     // face "cloud" width  (stage units) where lines stop
    var FACE_RY = 13.5;    // face "cloud" height (stage units)
    var EASE = 0.08;       // smaller = floatier
    var FLOAT = 0.3;       // idle bob size (stage units)
    var INTRO_MS = 1700;   // shining text shows at least this long
    var RESPIN_MS = 12000; // name re-spins this often

    // Font roulette. LAST one is where it lands. System fonts only: no downloads.
    var FONTS = [
        { f: 'Impact, Haettenschweiler, sans-serif',                w: 400, s: 'normal' },
        { f: 'Georgia, "Times New Roman", serif',                   w: 700, s: 'italic' },
        { f: '"Courier New", Courier, monospace',                   w: 700, s: 'normal' },
        { f: '"Brush Script MT", "Segoe Script", cursive',          w: 400, s: 'italic' },
        { f: '"Trebuchet MS", sans-serif',                          w: 700, s: 'normal' },
        { f: '"Palatino Linotype", Palatino, serif',                w: 700, s: 'normal' },
        { f: '"Arial Black", Gadget, sans-serif',                   w: 900, s: 'normal' },
        { f: '"Lucida Console", Monaco, monospace',                 w: 400, s: 'normal' },
        { f: 'Copperplate, "Copperplate Gothic Light", fantasy',    w: 700, s: 'normal' },
        { f: '"Segoe UI", system-ui, sans-serif',                   w: 700, s: 'normal' }
    ];
    var FINAL = FONTS.length - 1;

    var stage = document.getElementById('stage');
    var svg = document.getElementById('links');
    var faceEl = document.getElementById('face');
    var nameEl = document.getElementById('name');
    var bg = document.getElementById('bg');
    var loader = document.getElementById('loader');
    var mq = window.matchMedia('(max-width: 800px), (max-aspect-ratio: 1/1)');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var NS = 'http://www.w3.org/2000/svg';

    var face = { el: faceEl, x: 50, y: 28, cx: 0, cy: 0, isFace: true };
    var items = { face: face };
    var list = [];

    Array.prototype.forEach.call(document.querySelectorAll('.node'), function (el) {
        var it = {
            el: el,
            id: el.id,
            x: +el.dataset.x,
            y: +el.dataset.y,
            depth: +el.dataset.depth,
            parent: el.dataset.parent,
            phase: Math.random() * 6.283,
            cx: 0, cy: 0, hw: 0, hh: 0,
            leaf: el.classList.contains('leaf')
        };
        items[it.id] = it;
        list.push(it);
    });

    // one line + two port dots per link
    list.forEach(function (it) {
        it.line = document.createElementNS(NS, 'line');
        if (it.leaf) it.line.setAttribute('class', 'dash');
        it.dot1 = document.createElementNS(NS, 'circle');
        it.dot2 = document.createElementNS(NS, 'circle');
        it.dot1.setAttribute('r', 3.5);
        it.dot2.setAttribute('r', 3.5);
        svg.appendChild(it.line);
        svg.appendChild(it.dot1);
        svg.appendChild(it.dot2);
    });

    var W = 0, H = 0, unit = 1, faceDirty = true;
    function measure() {
        W = stage.clientWidth;
        H = stage.clientHeight;
        unit = W / 100;
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        list.forEach(function (it) {
            var g = it.el.firstElementChild;
            it.hw = g.offsetWidth / 2;
            it.hh = g.offsetHeight / 2;
        });
        faceDirty = true;
    }

    function edgeRect(cx, cy, tx, ty, hw, hh) {
        var dx = tx - cx, dy = ty - cy;
        var t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
        return [cx + dx * t, cy + dy * t];
    }
    function edgeEllipse(cx, cy, tx, ty, rx, ry) {
        var dx = tx - cx, dy = ty - cy;
        var t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
        return [cx + dx * t, cy + dy * t];
    }

    // mouse (-1..1), eased
    var tx = 0, ty = 0, mx = 0, my = 0;
    window.addEventListener('pointermove', function (e) {
        tx = (e.clientX / window.innerWidth - 0.5) * 2;
        ty = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    document.addEventListener('pointerleave', function () { tx = 0; ty = 0; });

    function placeFace() {
        face.cx = face.x * unit;
        face.cy = face.y * unit;
        face.el.style.transform =
            'translate(' + face.cx + 'px,' + face.cy + 'px) translate(-50%,-50%)';
    }

    function placeNode(it, t) {
        var bobX = reduce ? 0 : Math.sin(t / 1700 + it.phase) * FLOAT * unit;
        var bobY = reduce ? 0 : Math.cos(t / 1300 + it.phase) * FLOAT * unit;
        it.cx = it.x * unit - mx * it.depth * unit + bobX;
        it.cy = it.y * unit - my * it.depth * unit + bobY;
        it.el.style.transform =
            'translate(' + it.cx + 'px,' + it.cy + 'px) translate(-50%,-50%)';
    }

    function frame(t) {
        requestAnimationFrame(frame);
        if (mq.matches) return;

        mx += (tx - mx) * EASE;
        my += (ty - my) * EASE;

        if (faceDirty) { placeFace(); faceDirty = false; }
        list.forEach(function (it) { placeNode(it, t); });

        list.forEach(function (it) {
            var p = items[it.parent];
            var a, b;
            if (p.isFace) {
                a = edgeEllipse(p.cx, p.cy, it.cx, it.cy, FACE_RX * unit, FACE_RY * unit);
            } else {
                a = edgeRect(p.cx, p.cy, it.cx, it.cy, p.hw, p.hh);
            }
            b = edgeRect(it.cx, it.cy, p.cx, p.cy, it.hw, it.hh);
            it.line.setAttribute('x1', a[0]); it.line.setAttribute('y1', a[1]);
            it.line.setAttribute('x2', b[0]); it.line.setAttribute('y2', b[1]);
            it.dot1.setAttribute('cx', a[0]); it.dot1.setAttribute('cy', a[1]);
            it.dot2.setAttribute('cx', b[0]); it.dot2.setAttribute('cy', b[1]);
        });

        bg.style.setProperty('--mx', ((mx + 1) / 2 * 100) + '%');
        bg.style.setProperty('--my', ((my + 1) / 2 * 100) + '%');
        bg.style.backgroundPosition = '0 0, ' + (-mx * 14) + 'px ' + (-my * 14) + 'px';
    }

    // ---- font roulette: spins fast, slows down, lands ----
    var spinning = false, lastFont = -1;
    function applyFont(i) {
        var f = FONTS[i];
        nameEl.style.fontFamily = f.f;
        nameEl.style.fontWeight = f.w;
        nameEl.style.fontStyle = f.s;
        lastFont = i;
    }
    function spin() {
        if (spinning || reduce || document.hidden) return;
        spinning = true;
        var delay = 60;
        (function step() {
            if (delay > 300) { applyFont(FINAL); spinning = false; return; }
            var n;
            do { n = Math.floor(Math.random() * FINAL); } while (n === lastFont);
            applyFont(n);
            delay *= 1.16;
            setTimeout(step, delay);
        })();
    }
    applyFont(FINAL);
    nameEl.addEventListener('pointerenter', spin);
    nameEl.addEventListener('click', spin);
    setInterval(spin, RESPIN_MS);

    // ---- intro: shining text, then build the diagram piece by piece ----
    function show(it, ms) {
        setTimeout(function () {
            it.el.classList.add('on');
            it.line.classList.add('on');
            it.dot1.classList.add('on');
            it.dot2.classList.add('on');
        }, ms);
    }
    function reveal() {
        face.el.classList.add('on');
        nameEl.classList.add('on');
        var step = reduce ? 0 : 110;
        var base = reduce ? 0 : 450;
        var t1 = list.filter(function (it) { return it.parent === 'face'; });
        var t2 = list.filter(function (it) { return it.parent !== 'face'; });
        t1.forEach(function (it, i) { show(it, base + i * step); });
        t2.forEach(function (it, j) { show(it, base + t1.length * step + 250 + j * step); });
        setTimeout(spin, base + list.length * step + 600);
    }

    var finished = false;
    function finish() {
        if (finished) return;
        finished = true;
        loader.classList.add('done');
        setTimeout(reveal, reduce ? 0 : 250);
    }

    var imgReady = new Promise(function (resolve) {
        if (faceEl.complete) return resolve();
        faceEl.addEventListener('load', resolve);
        faceEl.addEventListener('error', resolve);
    });
    var minWait = new Promise(function (resolve) { setTimeout(resolve, reduce ? 400 : INTRO_MS); });
    Promise.all([imgReady, minWait]).then(finish);
    setTimeout(finish, 5000); // safety: never trap the visitor on the loader

    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    measure();
    requestAnimationFrame(frame);
})();
