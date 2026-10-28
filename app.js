(function () {
    // ---- knobs ----
    var FACE_RX = 8.2;     // face "cloud" width  (stage units) where lines stop
    var FACE_RY = 13.5;    // face "cloud" height (stage units)
    var EASE = 0.08;       // smaller = floatier
    var FLOAT = 0.2;       // idle bob size (stage units)
    var PARALLAX = 0.35;   // mouse drift strength (1 = old, 0 = none)
    var INTRO_MS = 1700;   // shining text shows at least this long

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
            leaf: el.classList.contains('leaf'),
            link: el.dataset.link || 'copper'
        };
        items[it.id] = it;
        list.push(it);
    });

    // one line + two port dots per link
    list.forEach(function (it) {
        it.line = document.createElementNS(NS, 'path');
        it.line.setAttribute('class', it.link);
        it.dot1 = document.createElementNS(NS, 'circle');
        it.dot2 = document.createElementNS(NS, 'circle');
        it.dot1.setAttribute('class', it.link);
        it.dot2.setAttribute('class', it.link);
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

    // serial cable: straight line with a lightning-bolt kink in the middle
    var ZIG_AMP = 1.1; // kink size (stage units)
    function zigzag(a, b) {
        var dx = b[0] - a[0], dy = b[1] - a[1];
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = -dy / len, ny = dx / len;
        var amp = ZIG_AMP * unit;
        var marks = [[0.30, 0], [0.38, 1], [0.46, -1], [0.54, 1], [0.62, -1], [0.70, 0]];
        var d = 'M' + a[0] + ' ' + a[1];
        marks.forEach(function (m) {
            d += 'L' + (a[0] + dx * m[0] + nx * amp * m[1]) + ' ' + (a[1] + dy * m[0] + ny * amp * m[1]);
        });
        return d + 'L' + b[0] + ' ' + b[1];
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
        it.cx = it.x * unit - mx * it.depth * PARALLAX * unit + bobX;
        it.cy = it.y * unit - my * it.depth * PARALLAX * unit + bobY;
        it.el.style.transform =
            'translate(' + it.cx + 'px,' + it.cy + 'px) translate(-50%,-50%)';
    }

    function frame(t) {
        requestAnimationFrame(frame);
        if (mq.matches) return;
        // a panel is open: freeze the scene, save power
        if (document.documentElement.classList.contains('panel-open')) return;

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
            it.line.setAttribute('d', it.link === 'serial'
                ? zigzag(a, b)
                : 'M' + a[0] + ' ' + a[1] + 'L' + b[0] + ' ' + b[1]);
            it.dot1.setAttribute('cx', a[0]); it.dot1.setAttribute('cy', a[1]);
            it.dot2.setAttribute('cx', b[0]); it.dot2.setAttribute('cy', b[1]);
        });

        bg.style.setProperty('--mx', ((mx + 1) / 2 * 100) + '%');
        bg.style.setProperty('--my', ((my + 1) / 2 * 100) + '%');
        bg.style.backgroundPosition = '0 0, ' + (-mx * 14) + 'px ' + (-my * 14) + 'px';
    }

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
