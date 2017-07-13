/**
* Copyright (c) 2017, Leon Sorokin
* All rights reserved. (MIT Licensed)
*
* domvm.full.js - DOM ViewModel
* A thin, fast, dependency-free vdom view layer
* @preserve https://github.com/leeoniya/domvm (3.x-dev, ssr)
*/

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.domvm = factory());
}(this, (function () { 'use strict';

// NOTE: if adding a new *VNode* type, make it < COMMENT and renumber rest.
// There are some places that test <= COMMENT to assert if node is a VNode

// VNode types




// placeholder types

function noop() {}

var isArr = Array.isArray;

function isSet(val) {
	return val != null;
}

function isPlainObj(val) {
	return val != null && val.constructor === Object;		//  && typeof val === "object"
}





function isFunc(val) {
	return typeof val === "function";
}







// export const defProp = Object.defineProperty;



/*
export function deepUnset(targ, path) {
	var seg;

	while (seg = path.shift()) {
		if (path.length === 0)
			targ[seg] = val;
		else
			targ[seg] = targ = targ[seg] || {};
	}
}
*/







// https://github.com/darsain/raft
// rAF throttler, aggregates multiple repeated redraw calls within single animframe




/*
export function prop(val, cb, ctx, args) {
	return function(newVal, execCb) {
		if (newVal !== undefined && newVal !== val) {
			val = newVal;
			execCb !== false && isFunc(cb) && cb.apply(ctx, args);
		}

		return val;
	};
}
*/

// adapted from https://github.com/Olical/binary-search

function isEvProp(name) {
	return name[0] === "o" && name[1] === "n";
}







// tests interactive props where real val should be compared

var unitlessProps = {
	animationIterationCount: true,
	boxFlex: true,
	boxFlexGroup: true,
	boxOrdinalGroup: true,
	columnCount: true,
	flex: true,
	flexGrow: true,
	flexPositive: true,
	flexShrink: true,
	flexNegative: true,
	flexOrder: true,
	gridRow: true,
	gridColumn: true,
	order: true,
	lineClamp: true,

	borderImageOutset: true,
	borderImageSlice: true,
	borderImageWidth: true,
	fontWeight: true,
	lineHeight: true,
	opacity: true,
	orphans: true,
	tabSize: true,
	widows: true,
	zIndex: true,
	zoom: true,

	fillOpacity: true,
	floodOpacity: true,
	stopOpacity: true,
	strokeDasharray: true,
	strokeDashoffset: true,
	strokeMiterlimit: true,
	strokeOpacity: true,
	strokeWidth: true
};

function autoPx(name, val) {
	{
		// typeof val === 'number' is faster but fails for numeric strings
		return !isNaN(val) && !unitlessProps[name] ? (val + "px") : val;
	}
}

var tagCache = {};

var RE_ATTRS = /\[(\w+)(?:=(\w+))?\]/g;

function cssTag(raw) {
	{
		var cached = tagCache[raw];

		if (cached == null) {
			var tag, id, cls, attr;

			tagCache[raw] = cached = {
				tag:	(tag	= raw.match( /^[-\w]+/))		?	tag[0]						: "div",
				id:		(id		= raw.match( /#([-\w]+)/))		? 	id[1]						: null,
				class:	(cls	= raw.match(/\.([-\w.]+)/))		?	cls[1].replace(/\./g, " ")	: null,
				attrs:	null,
			};

			while (attr = RE_ATTRS.exec(raw)) {
				if (cached.attrs == null)
					{ cached.attrs = {}; }
				cached.attrs[attr[1]] = attr[2] || "";
			}
		}

		return cached;
	}
}

// (de)optimization flags

// prevents inserting/removing/reordering of children

// forces slow bottom-up removeChild to fire deep willRemove/willUnmount hooks,

// enables fast keyed lookup of children via binary search, expects homogeneous keyed body

// indicates an vnode match/diff/recycler function for body
var LAZY_LIST = 8;

var mockVm = {
	view: null,
	data: null,
	key: null,
	opts: null,
	state: null,
	api: null,
	config: noop,
};

function createView(view, data, key, opts) {
	mockVm.view = view;
	mockVm.data = data;
	mockVm.key = key;
	mockVm.opts = opts;

	if (isFunc(view))
		{ var out = view(mockVm, data, key, opts); }
	else
		{ var out = view; }

	if (isFunc(out))
		{ var render = out; }
	else {
		var render = out.render;

		if (view.init)
			{ view.init(mockVm, data, key, opts); }		// if mockVm is shared and init stores data for specific instance, or .state or .api, won't work
	}

	return render(mockVm, data);
}

function defineElement(tag, arg1, arg2, flags) {
	// flatten templates (can't use .join)
	// remove false/undefined/null
	// defineText escaping

	var attrs, body;

	if (arg2 == null) {
		if (isPlainObj(arg1))
			{ attrs = arg1; }
		else
			{ body = arg1; }
	}
	else {
		attrs = arg1;
		body = arg2;
	}

	// pulled out of initElementNode, todo: dry
	var parsed = cssTag(tag);

	tag = parsed.tag;

	// meh, weak assertion, will fail for id=0, etc.
	if (parsed.id || parsed.class || parsed.attrs) {
		var p = attrs || {};

		if (parsed.id && !isSet(p.id))
			{ p.id = parsed.id; }

		if (parsed.class)
			{ p.class = parsed.class + (isSet(p.class) ? (" " + p.class) : ""); }
		if (parsed.attrs) {
			for (var key in parsed.attrs)
				{ if (!isSet(p[key]))
					{ p[key] = parsed.attrs[key]; } }
		}

		attrs = p;
	}

/*
	if (node.el != null && node.tag == null) {
		out = node.el.outerHTML;		// pre-existing dom elements (does not currently account for any props applied to them)
		break;
	}
*/

	var buf = "";

	buf += "<" + tag;

	if (attrs != null) {
		var style = null;

		for (var pname in attrs) {
			if (isEvProp(pname) || pname[0] === "." || pname[0] === "_" )		//	isSplProp		 || dynProps === false && isDynProp(tag, pname)
				{ continue; }

			var val = attrs[pname];

			if (pname === "style" && val != null) {
				style = typeof val === "object" ? styleStr(val) : val;
				continue;
			}

			if (val === true)
				{ buf += " " + escHtml(pname) + '=""'; }
			else if (val === false) {}
			else if (val != null)
				{ buf += " " + escHtml(pname) + '="' + escQuotes(val) + '"'; }
		}

		if (style != null)
			{ buf += ' style="' + escQuotes(style.trim()) + '"'; }
	}

	// if body-less svg node, auto-close & return
//	if (body == null && ns != null && tag !== "svg")
//		return buf + "/>";
//	else
		buf += ">";

	if (!voidTags[tag]) {
		if (isArr(body))
			{ buf += body.join(""); }
	//		buf += eachHtml(body, dynProps);
		else if ((flags & LAZY_LIST) === LAZY_LIST) {
		//	body.body(node);
		//	buf += eachHtml(body, dynProps);
		}
		else
			{ buf += escHtml(body); }
		//	buf += raw ? body : escHtml(body);

		buf += "</" + tag + ">";
	}

	return buf;

/*
	return (
		"<" + tag + (attrs ? procAttrs(attrs) : "") + ">" +
		(isArr(body) ? body.join("") : body) +
		"</" + tag + ">"
	);
*/
}





//injectView
//injectElement

/*
export function vmProtoHtml(dynProps) {
	var vm = this;

	if (vm.node == null)
		vm._redraw(null, null, false);

	return html(vm.node, dynProps);
};

export function vProtoHtml(dynProps) {
	return html(this, dynProps);
};
*/

function camelDash(val) {
	return val.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function styleStr(css) {
	var style = "";

	for (var pname in css) {
		if (css[pname] != null)
			{ style += camelDash(pname) + ": " + autoPx(pname, css[pname]) + '; '; }
	}

	return style;
}

function toStr(val) {
	return val == null ? '' : ''+val;
}

var voidTags = {
    area: true,
    base: true,
    br: true,
    col: true,
    command: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    keygen: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    track: true,
	wbr: true
};

function escHtml(s) {
	s = toStr(s);

	for (var i = 0, out = ''; i < s.length; i++) {
		switch (s[i]) {
			case '&': out += '&amp;';  break;
			case '<': out += '&lt;';   break;
			case '>': out += '&gt;';   break;
		//	case '"': out += '&quot;'; break;
		//	case "'": out += '&#039;'; break;
		//	case '/': out += '&#x2f;'; break;
			default:  out += s[i];
		}
	}

	return out;
}

function escQuotes(s) {
	s = toStr(s);

	for (var i = 0, out = ''; i < s.length; i++)
		{ out += s[i] === '"' ? '&quot;' : s[i]; }		// also &?

	return out;
}

var ssr = {
//	config,

//	ViewModel,
//	VNode,

	createView: createView,

	defineElement: defineElement,
//	defineSvgElement,
//	defineText,
//	defineComment,
	defineView: createView,

//	injectView,
//	injectElement,

//	lazyList,

//	FIXED_BODY,
//	DEEP_REMOVE,
//	KEYED_LIST,
//	LAZY_LIST,
};

return ssr;

})));
//# sourceMappingURL=domvm.ssr.js.map
