import { ELEMENT, TEXT, COMMENT, VVIEW, VMODEL } from '../VTYPES';
import { noop, isArr, isPlainObj, isVal, isFunc, isSet, ENV_DOM } from '../../utils';
import { isEvProp, isDynProp } from '../utils';
import { autoPx } from './autoPx';
import { LAZY_LIST } from '../initElementNode';
import { cssTag } from './cssTag';

const mockVm = {
	view: null,
	data: null,
	key: null,
	opts: null,
	state: null,
	api: null,
	config: noop,
};

export function createView(view, data, key, opts) {
	mockVm.view = view;
	mockVm.data = data;
	mockVm.key = key;
	mockVm.opts = opts;

	if (isFunc(view))
		var out = view(mockVm, data, key, opts)
	else
		var out = view;

	if (isFunc(out))
		var render = out;
	else {
		var render = out.render;

		if (view.init)
			view.init(mockVm, data, key, opts);		// if mockVm is shared and init stores data for specific instance, or .state or .api, won't work
	}

	return render(mockVm, data);
}

export { createView as defineView };

export function defineElement(tag, arg1, arg2, flags) {
	// flatten templates (can't use .join)
	// remove false/undefined/null
	// defineText escaping

	var attrs, body;

	if (arg2 == null) {
		if (isPlainObj(arg1))
			attrs = arg1;
		else
			body = arg1;
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
			p.id = parsed.id;

		if (parsed.class)
			p.class = parsed.class + (isSet(p.class) ? (" " + p.class) : "");
		if (parsed.attrs) {
			for (var key in parsed.attrs)
				if (!isSet(p[key]))
					p[key] = parsed.attrs[key];
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
				continue;

			var val = attrs[pname];

			if (pname === "style" && val != null) {
				style = typeof val === "object" ? styleStr(val) : val;
				continue;
			}

			if (val === true)
				buf += " " + escHtml(pname) + '=""';
			else if (val === false) {}
			else if (val != null)
				buf += " " + escHtml(pname) + '="' + escQuotes(val) + '"';
		}

		if (style != null)
			buf += ' style="' + escQuotes(style.trim()) + '"';
	}

	// if body-less svg node, auto-close & return
//	if (body == null && ns != null && tag !== "svg")
//		return buf + "/>";
//	else
		buf += ">";

	if (!voidTags[tag]) {
		if (isArr(body))
			buf += body.join("");
	//		buf += eachHtml(body, dynProps);
		else if ((flags & LAZY_LIST) === LAZY_LIST) {
		//	body.body(node);
		//	buf += eachHtml(body, dynProps);
		}
		else
			buf += escHtml(body);
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

export function defineSvgElement() {}
export function defineText() {}
export function defineComment() {}

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
			style += camelDash(pname) + ": " + autoPx(pname, css[pname]) + '; ';
	}

	return style;
}

function toStr(val) {
	return val == null ? '' : ''+val;
}

const voidTags = {
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
		out += s[i] === '"' ? '&quot;' : s[i];		// also &?

	return out;
}

/*
function eachHtml(arr, dynProps) {
	var buf = '';
	for (var i = 0; i < arr.length; i++)
		buf += html(arr[i], dynProps);
	return buf;
}
*/

function html(node, dynProps) {
	var out, style;

	switch (node.type) {
		case VVIEW:
			out = createView(node.view, node.data, node.key, node.opts).html(dynProps);
			break;
		case VMODEL:
			out = node.vm.html();
			break;
		case ELEMENT:
			// out
			break;
		case TEXT:
			out = escHtml(node.body);
			break;
		case COMMENT:
			out = "<!--" + escHtml(node.body) + "-->";
			break;
	}

	return out;
};