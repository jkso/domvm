QUnit.module("Various Others", function() {
	var imperView = null;

	function SomeView(vm) {
		return function() {
			return el("div", [
				el("div", [
					el("strong", [
						vw(SomeView2)
					]),
					!!imperView && iv(imperView),
				])
			]);
		};
	}

	function SomeView2(vm) {
		return function() {
			return el("em", "yay!");
		};
	}

	var vm;

	QUnit.test('Init sub-view buried in plain nodes', function(assert) {
		var expcHtml = '<div><div><strong><em>yay!</em></strong></div></div>';

		instr.start();
		vm = domvm.createView(SomeView).mount(testyDiv);
		var callCounts = instr.end();

		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { createElement: 4, insertBefore: 4, textContent: 1 });
	});

	QUnit.test('html() renders subviews without explicit mount()', function(assert) {
		imperView = domvm.createView(SomeView2);

		instr.start();
		vm = domvm.createView(SomeView);
		var callCounts = instr.end();

		var expcHtml = '<div><div><strong><em>yay!</em></strong><em>yay!</em></div></div>';
		assert.equal(vm.html(), expcHtml);
	});

	QUnit.test('Inserted nodes should not be matched up to sibling views with same root tags', function(assert) {
		var nulls = false;

		function ViewX() {
			return function() {
				return el("div", [
					nulls ? null : el("div"),
					vw(ViewY),
					nulls ? null : el("div"),
				]);
			}
		}

		function ViewY() {
			return function() {
				return el("div", "foo");
			};
		}

		instr.start();
		vm = domvm.createView(ViewX).mount(testyDiv);
		var callCounts = instr.end();

		var expcHtml = '<div><div></div><div>foo</div><div></div></div>';
		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { createElement: 4, insertBefore: 4, textContent: 1 });

		nulls = true;

		instr.start();
		vm.redraw();
		var callCounts = instr.end();

		var expcHtml = '<div><div>foo</div></div>';
		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { removeChild: 2 });

		nulls = false;
		instr.start();
		vm.redraw();
		var callCounts = instr.end();

		var expcHtml = '<div><div></div><div>foo</div><div></div></div>';
		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { createElement: 2, insertBefore: 2 });
	});

	function FlattenView(vm) {
		return function() {
			return el("div", [
				el("br"),
				tx("hello kitteh"),
				[
					el("em", "foo"),
					el("em", "bar"),
					vw(SomeView2),
					tx("woohoo!"),
					[
						vw(SomeView2),
						el("i", "another thing"),
					]
				],
				tx("the end"),
			]);
		};
	}

	QUnit.test('Flatten child sub-arrays', function(assert) {
		var expcHtml = '<div><br>hello kitteh<em>foo</em><em>bar</em><em>yay!</em>woohoo!<em>yay!</em><i>another thing</i>the end</div>';

		instr.start();
		vm = domvm.createView(FlattenView).mount(testyDiv);
		var callCounts = instr.end();

		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { createElement: 7, createTextNode: 3, insertBefore: 10, textContent: 5 });
	});

	function SomeView3() {
		return function() {
			return el("em", {style: {width: 30, zIndex: 5}}, "test");
		};
	}

	QUnit.test('"px" appended only to proper numeric style attrs', function(assert) {
		var expcHtml = '<em style="width: 30px; z-index: 5;">test</em>';

		instr.start();
		vm = domvm.createView(SomeView3).mount(testyDiv);
		var callCounts = instr.end();

		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { createElement: 1, textContent: 1, insertBefore: 1 });
	});

	// TODO: how to test mounting to body without blowing away test?
	QUnit.test('Mount to existing element instead of append into', function(assert) {
		var em = document.createElement("em");
		em.textContent = "abc";
		testyDiv.appendChild(em);

		var expcHtml = '<em style="width: 30px; z-index: 5;">test</em>';

		instr.start();
		vm = domvm.createView(SomeView3).mount(em, true);
		var callCounts = instr.end();

		evalOut(assert, em, vm.html(), expcHtml, callCounts, { textContent: 2, insertBefore: 1 });
	});

	QUnit.test('Raw HTML as body', function(assert) {
		function View5(vm) {
			return function() {
				return el("div", {".innerHTML": '<p class="foo">bar</p>&nbsp;baz'});		// .html()
			};
		}

		var expcHtml = '<div><p class="foo">bar</p>&nbsp;baz</div>';

		instr.start();
		vm = domvm.createView(View5).mount(testyDiv);
		var callCounts = instr.end();

		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { createElement: 1, innerHTML: 1, insertBefore: 1 });

		var tab = 1;

		function View51() {
			return function() {
				return el('div', [
					tab === 2 && el('span', 'foo'),
					el('span', {".innerHTML": 'bar <b>baz</b>'})
				]);
			};
		}

		var expcHtml = '<div><span>bar <b>baz</b></span></div>';

		instr.start();
		vm = domvm.createView(View51).mount(testyDiv);
		var callCounts = instr.end();

		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { createElement: 2, innerHTML: 1, insertBefore: 2 });

		tab = 2;

		var expcHtml = '<div><span>foo</span><span>bar <b>baz</b></span></div>';

		instr.start();
		vm.redraw();
		var callCounts = instr.end();

		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { createElement: 1, textContent: 1, innerHTML: 2, insertBefore: 1 });
	});

	QUnit.test('Existing DOM element as child', function(assert) {
		var el2 = document.createElement("strong");
		el2.textContent = "cow";

		var body = [
			ie(el2),
			tx("abc"),
		];

		function View6(vm) {
			return function() {
				return el("div", body);
			};
		}

		var expcHtml = '<div><strong>cow</strong>abc</div>';

		instr.start();
		vm = domvm.createView(View6).mount(testyDiv);
		var callCounts = instr.end();

		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { createElement: 1, createTextNode: 1, insertBefore: 3 });


		// TODO: ensure injected elems get matched exactly during findDonor

		var body = [
			tx("abc"),
			ie(el2),
		];

		var expcHtml = '<div>abc<strong>cow</strong></div>';

		instr.start();
		vm.redraw();
		var callCounts = instr.end();

		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { insertBefore: 1 });
	});

	QUnit.test('Externally inserted element', function(assert) {
		var ins = false;

		function View6(vm) {
			return function() {
				return el("div", [
					el("span", "a"),
					ins ? el("i", "me") : null,
					el("em", "b"),
				]);
			};
		}

		var expcHtml = '<div><span>a</span><em>b</em></div>';

		instr.start();
		vm = domvm.createView(View6).mount(testyDiv);
		var callCounts = instr.end();

		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { createElement: 3, textContent: 2, insertBefore: 3 });

		var el2 = document.createElement("strong");
		el2.textContent = "cow";

		vm.node.el.insertBefore(el2, vm.node.el.lastChild);

		var expcHtml = '<div><span>a</span><strong>cow</strong><em>b</em></div>';

		instr.start();
		vm.redraw();
		var callCounts = instr.end();

		evalOut(assert, vm.node.el, vm.html().replace("</span><em>","</span><strong>cow</strong><em>"), expcHtml, callCounts, { });

		ins = true;

		var expcHtml = "<div><span>a</span><strong>cow</strong><i>me</i><em>b</em></div>";

		instr.start();
		vm.redraw();
		var callCounts = instr.end();

		evalOut(assert, vm.node.el, vm.html().replace("</span><i>","</span><strong>cow</strong><i>"), expcHtml, callCounts, { createElement: 1, textContent: 1, insertBefore: 1});
	});

	QUnit.test('Remove/clean child of sub-view', function(assert) {
		var data = ["a"];
		var data2 = ["b", "c"];

		function View6(vm) {
			return function() {
				return el("div", [
					el("p", data[0]),
					vw(View7, data2),
				]);
			};
		}

		function View7(vm, data2) {
			return function() {
				return el("ul", data2.map(function(v) {
					return el("li", v);
				}));
			};
		}

		instr.start();
		vm = domvm.createView(View6).mount(testyDiv);
		var callCounts = instr.end();

		var expcHtml = '<div><p>a</p><ul><li>b</li><li>c</li></ul></div>';

		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { createElement: 5, textContent: 3, insertBefore: 5 });

		data2.shift();

		instr.start();
		vm.redraw();
		var callCounts = instr.end();

		var expcHtml = '<div><p>a</p><ul><li>c</li></ul></div>';

		evalOut(assert, vm.node.el, vm.html(), expcHtml, callCounts, { removeChild: 1, nodeValue: 1 });
	});

	QUnit.test('vm.root()', function(assert) {
		var vmA, vmB, vmC;

		function ViewA(vm) {
			vmA = vm;
			return function() {
				return el("#a", [
					vw(ViewB)
				]);
			}
		}

		function ViewB(vm) {
			vmB = vm;
			return function() {
				return el("#b", [
					vw(ViewC)
				]);
			};
		}

		function ViewC(vm) {
			vmC = vm;
			return function() {
				return el("#c", "Hi!");
			};
		}

		domvm.createView(ViewA).mount(testyDiv);

		assert.equal(vmC.root(), vmA);
		assert.equal(vmB.root(), vmA);
		assert.equal(vmA.root(), vmA);
	});

	QUnit.test('defineElementSpread', function(assert) {
		var el2 = domvm.defineElementSpread;

		function ViewA(vm) {
			return function() {
				return el2("#a", vw(ViewB));
			}
		}

		function ViewB(vm) {
			return function() {
				return el2("#b", "b");
			}
		}

		function ViewC(vm) {
			return function() {
				return el2("#c", {class: "foo"}, "c");
			}
		}

		function ViewD(vm) {
			return function() {
				return el2("#d", "d", "dog");
			}
		}

		function ViewE(vm) {
			return function() {
				return el2("#e");
			}
		}

		instr.start();
		var vmA = domvm.createView(ViewA).mount(testyDiv);
		var callCounts = instr.end();
		var expcHtml = '<div id="a"><div id="b">b</div></div>';
		evalOut(assert, vmA.node.el, vmA.html(), expcHtml, callCounts, { createElement: 2, id: 2, insertBefore: 2, textContent: 1 });

		instr.start();
		var vmC = domvm.createView(ViewC).mount(testyDiv);
		var callCounts = instr.end();
		var expcHtml = '<div class="foo" id="c">c</div>';
		evalOut(assert, vmC.node.el, vmC.html(), expcHtml, callCounts, { createElement: 1, id: 1, className: 1, insertBefore: 1, textContent: 1 });

		instr.start();
		var vmD = domvm.createView(ViewD).mount(testyDiv);
		var callCounts = instr.end();
		var expcHtml = '<div id="d">ddog</div>';
		evalOut(assert, vmD.node.el, vmD.html(), expcHtml, callCounts, { createElement: 1, id: 1, createTextNode: 1, insertBefore: 2 });

		instr.start();
		var vmE = domvm.createView(ViewE).mount(testyDiv);
		var callCounts = instr.end();
		var expcHtml = '<div id="e"></div>';
		evalOut(assert, vmE.node.el, vmE.html(), expcHtml, callCounts, { createElement: 1, id: 1, insertBefore: 1 });
	});

	QUnit.test('defineElementSpread', function(assert) {
		function ViewA(vm) {
			return function() {
				return el("#a", [
					vw(ViewB),
					el("div", [
						vw(ViewB)
					])
				]);
			}
		}

		var vmBs = [];

		function ViewB(vm) {
			vmBs.push(vm);

			return function() {
				return el("#b", "b");
			}
		}

		instr.start();
		var vmA = domvm.createView(ViewA).mount(testyDiv);
		var callCounts = instr.end();
		var expcHtml = '<div id="a"><div id="b">b</div><div><div id="b">b</div></div></div>';
		evalOut(assert, vmA.node.el, vmA.html(), expcHtml, callCounts, { createElement: 4, id: 3, insertBefore: 4, textContent: 2 });
		var vmbody = vmA.body();
		assert.equal(vmbody.length, 2);
		assert.equal(vmbody[0], vmBs[0]);
		assert.equal(vmbody[1], vmBs[1]);

		assert.deepEqual(vmbody[0].body(), []);
	});
});