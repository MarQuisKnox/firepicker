var cumulativeOffset = function(element) {
  var top = 0, left = 0;
  do {
    top  += element.offsetTop  || 0;
    left += element.offsetLeft || 0;
  } while (element = element.offsetParent);
  return {left: left, top: top};
};

var stopEvent = function(e) {
  e.preventDefault();
  e.stopPropagation();
};

var bind = function(fun, obj) {
  return function() {
    return fun.apply(obj, arguments);
  }
};

var Color = {
  rgbFloatToHex: function(floatNum) {
    var CHARS = '0123456789ABCDEF', n256 = Math.round(floatNum * 255);
    return CHARS.charAt((n256-n256%16)/16) + CHARS.charAt(n256%16);
  },

  HSV2RGB: function(h, s, v) {
    if (h + 0.0000000001 >= 1) {h = 0}
    h *= 6;

    var i = parseInt(h, 10),
        f = h - i,
        p = v * (1 - s),
        q = v * (1 - s * f),
        t = v * (1 - s * (1 - f)),
        r, g, b;

    switch (i) {
        case 0: r=v; g=t; b=p; break;
        case 1: r=q; g=v; b=p; break;
        case 2: r=p; g=v; b=t; break;
        case 3: r=p; g=q; b=v; break;
        case 4: r=t; g=p; b=v; break;
        case 5: r=v; g=p; b=q; break;
    }

    return '#' + this.rgbFloatToHex(r) + this.rgbFloatToHex(g) + this.rgbFloatToHex(b);
  },

  RGB2HSV: function(r, g, b) {
    var max   = Math.max(r, g, b),
        min   = Math.min(r, g, b),
        delta = max - min,
        s     = (max === 0) ? 0 : 1-(min/max),
        v     = max, h;

    switch (max) {
       case min: h=0; break;
       case r:   h=(g-b)/delta;
                 if (g<b) {h+=6}
                 break;
       case g:   h=2+(b-r)/delta; break;
       case b:   h=4+(r-g)/delta; break;
    }

    return {h: h / 6, s: s, v: v / 255};
  },

  HTML2RGB: function(html) {
    var sliceParseHex = function(start, end) { return parseInt(html.slice(start, end), 16) * (end - start == 1 ? 17 : 1); };
    return html.length == 4 ? {r: sliceParseHex(1,2), g: sliceParseHex(2,3), b: sliceParseHex(3,4)} :
                              {r: sliceParseHex(1,3), g: sliceParseHex(3,5), b: sliceParseHex(5,7)}
  },

  HTML2HSV: function(html) {
    var rgb = this.HTML2RGB(html);
    return this.RGB2HSV(rgb.r, rgb.g, rgb.b);
  }
};

var ColorPicker = function(element, color, callback) {
  this.document = element.ownerDocument;
  this.setupSB(element.querySelector('div.saturation_brightness'));
  this.setupHue(element.querySelector('div.hue'));
  this.setupBounds();
  this.setupObservers();
  this.callback = callback;
  this.setColor(color);
};

ColorPicker.prototype = {
  dispose: function() {
    this.sbPicker.removeEventListener('mousedown', this.sbMousedown);
    this.huePicker.removeEventListener('mousedown', this.hueMousedown);
    this.document.body.removeEventListener('mousemove', this.mouseMove);
    this.document.body.removeEventListener('mouseup', this.mouseUp);
  },

  setupSB: function(sbElement) {
    this.sbPicker     = sbElement;
    sbElement.borders = this.getBorderWidths(sbElement);
    this.sbHandle     = sbElement.querySelector('img');
    this.sbWidth      = sbElement.offsetWidth  - sbElement.borders.left - sbElement.borders.right;
    this.sbHeight     = sbElement.offsetHeight - sbElement.borders.top  - sbElement.borders.bottom;
  },

  getBorderWidths: function(el) {
    var borders = {}, borderTypes = ['top', 'right', 'bottom', 'left'], borderType, borderCSSName;
    for (var i = 0; borderType = borderTypes[i++];) {
      borderCSSName = 'border' + borderType.charAt(0).toUpperCase() + borderType.substring(1) + 'Width';
      borders[borderType] = parseInt(el.style[borderCSSName] || document.defaultView.getComputedStyle(el, null)[borderCSSName], 10);
    }
    return borders;
  },

  setupHue: function(hueElement) {
    this.huePicker     = hueElement;
    hueElement.borders = this.getBorderWidths(hueElement);
    this.hueHandle     = hueElement.querySelector('img');
    this.hueHeight     = hueElement.offsetHeight - hueElement.borders.top - hueElement.borders.bottom;
  },

  setupBounds: function() {
    var methodsToBind = ['sbMousedown', 'hueMousedown', 'mouseMove', 'mouseUp'], i = methodsToBind.length;
    while(i--) { this[methodsToBind[i]] = bind(this[methodsToBind[i]], this); }
  },

  setupObservers: function() {
    this.sbPicker.addEventListener('mousedown', this.sbMousedown, false);
    this.huePicker.addEventListener('mousedown', this.hueMousedown, false);
    this.document.body.addEventListener('mousemove', this.mouseMove, false)
    this.document.body.addEventListener('mouseup', this.mouseUp, false);
  },

  cumulativeOffsetWithBorders: function(element) {
    var offset = cumulativeOffset(element);
    return {top: offset.top + element.borders.top, left: offset.left + element.borders.left};
  },

  sbMousedown: function(e) {
    this.sbDrag = true;
    this.offset = this.cumulativeOffsetWithBorders(this.sbPicker);
    this.mouseMove(e);
  },

  hueMousedown: function(e) {
    this.hueDrag = true;
    this.offset  = this.cumulativeOffsetWithBorders(this.huePicker);
    this.mouseMove(e);
  },

  mouseMove: function(e) {
    if (this.sbDrag) {
      stopEvent(e);
      this.setSbPicker(e.pageY - this.offset.top, e.pageX - this.offset.left);
      this.colorChanged();
    } else if (this.hueDrag) {
      stopEvent(e);
      this.setHue(e.pageY - this.offset.top);
      this.colorChanged();
    }
  },

  mouseUp: function(e) {
    this.mouseMove(e);
    this.sbDrag = this.hueDrag = false;
  },

  setColor: function(html) {
    var hsv = html.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})/) ? Color.HTML2HSV(html) : {h: this.h || 1, s: this.s || 1, v: this.v || 1};
    this.setHue(Math.round(Math.abs(1 - hsv.h) * this.hueHeight));
    this.setSbPicker(this.sbHeight - Math.round(hsv.v * this.sbHeight), Math.round(hsv.s * this.sbWidth));
  },

  setHue: function(top) {
    top    = this.makeWithin(top, 0, this.hueHeight);
    this.h = (this.hueHeight - top) / this.hueHeight;
    this.hueHandle.style.top            = top + 'px';
    this.sbPicker.style.backgroundColor = Color.HSV2RGB(this.h, 1, 1);
  },

  setSbPicker: function(top, left) {
    top  = this.makeWithin(top,  0, this.sbHeight);
    left = this.makeWithin(left, 0, this.sbWidth);
    this.v = (this.sbHeight - top) / this.sbHeight;
    this.s = left / this.sbWidth;
    this.sbHandle.style.top  = top  + 'px';
    this.sbHandle.style.left = left + 'px';
  },

  colorChanged: function() {
    this.callback(this.getRGBColor());
  },

  getRGBColor: function() {
    return Color.HSV2RGB(this.h, this.s, this.v);
  },

  makeWithin: function(val, min, max) {
    return val < min ? min : (val > max ? max : val);
  }
};

document.initColorPicker = function(color, callback) {
  if (!window.colorPicker) {
    colorPicker = new ColorPicker(document.getElementById('picker'), color, callback);
  } else {
    colorPicker.callback = callback;
    colorPicker.setColor(color);
  }
};